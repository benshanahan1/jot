#!/usr/bin/env bash
# Installs a `jot` shell command that opens files in the jot app, or removes it.
#
#   scripts/install-cli.sh                  install (or update) the command
#   scripts/install-cli.sh --uninstall      remove the command and its zsh completion
#
# Options:
#   --name NAME      command name (default: jot)
#   --bin-dir DIR    where to put the command (default: $JOT_BIN_DIR or ~/.local/bin)
set -euo pipefail

NAME="jot"
BIN_DIR="${JOT_BIN_DIR:-$HOME/.local/bin}"
ACTION="install"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUNDLE_ID="com.ben.jot"
WRAPPER_MARKER="# Installed by jot's scripts/install-cli.sh"
ZSHRC="${ZDOTDIR:-$HOME}/.zshrc"
COMPLETION_BEGIN="# >>> jot cli completion >>>"
COMPLETION_END="# <<< jot cli completion <<<"
# Written by earlier versions of this script.
LEGACY_COMPLETION_COMMENT="# jot CLI: complete file paths for the app command."

usage() {
  sed -n '2,10s/^# \{0,1\}//p' "${BASH_SOURCE[0]}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --uninstall) ACTION="uninstall" ;;
    --name) NAME="${2:?--name needs a value}"; shift ;;
    --bin-dir) BIN_DIR="${2:?--bin-dir needs a value}"; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
    *) NAME="$1" ;; # Positional name, for compatibility with earlier versions.
  esac
  shift
done

TARGET="$BIN_DIR/$NAME"

# Prints the jot.app bundle (or a locally built binary) to launch.
detect_app() {
  local candidate
  for candidate in \
    "/Applications/jot.app" \
    "/Applications/Jot.app" \
    "$HOME/Applications/jot.app" \
    "$HOME/Applications/Jot.app"; do
    if [[ -d "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  # Installed somewhere else? Ask Spotlight.
  if command -v mdfind >/dev/null 2>&1; then
    candidate="$(mdfind "kMDItemCFBundleIdentifier == '$BUNDLE_ID'" 2>/dev/null | head -n 1)"
    if [[ -n "$candidate" && -d "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  fi

  candidate="$REPO_ROOT/src-tauri/target/release/jot"
  if [[ -x "$candidate" ]]; then
    echo "$candidate"
    return 0
  fi

  return 1
}

# True if $1 is a command this script (current or earlier version) wrote.
is_jot_wrapper() {
  local file="$1"
  [[ -f "$file" && ! -L "$file" ]] || return 1
  [[ "$(wc -c < "$file")" -lt 4096 ]] || return 1
  grep -Fq "$WRAPPER_MARKER" "$file" && return 0
  grep -Eq '^exec "[^"]*(/[jJ]ot\.app/Contents/MacOS/[jJ]ot|/src-tauri/target/release/jot)" "\$@"$' "$file"
}

# Prints every jot wrapper on PATH, plus the target location.
find_wrappers() {
  local dir seen=":"
  local IFS=':'
  for dir in $PATH $BIN_DIR; do
    [[ -n "$dir" && "$seen" != *":$dir:"* ]] || continue
    seen="$seen$dir:"
    if is_jot_wrapper "$dir/$NAME"; then
      echo "$dir/$NAME"
    fi
  done
}

remove_wrappers() {
  local wrapper
  while IFS= read -r wrapper; do
    [[ -n "$wrapper" ]] || continue
    rm -f "$wrapper"
    echo "Removed $wrapper"
  done < <(find_wrappers)
}

write_wrapper() {
  local app="$1"
  mkdir -p "$BIN_DIR"

  if [[ "$app" == *.app ]]; then
    cat > "$TARGET" <<EOF
#!/bin/sh
$WRAPPER_MARKER
app="$app"
if [ ! -d "\$app" ]; then
  echo "$NAME: \$app not found. Reinstall jot, or remove this command with:" >&2
  echo "  $REPO_ROOT/scripts/install-cli.sh --uninstall" >&2
  exit 1
fi
# \`open\` launches the app from /, so make relative paths absolute.
all_exist=1
for arg do
  shift
  case \$arg in /*|-*) ;; *) arg=\$PWD/\$arg ;; esac
  [ -e "\$arg" ] || all_exist=0
  set -- "\$@" "\$arg"
done
if [ "\$all_exist" = 1 ]; then
  # Hands existing files straight to the running app (or launches it).
  exec open -a "\$app" "\$@"
fi
# New files can't go through Finder, so start a new process; it passes them to any running
# instance and exits.
exec open -n -a "\$app" --args "\$@"
EOF
  else
    cat > "$TARGET" <<EOF
#!/bin/sh
$WRAPPER_MARKER
bin="$app"
if [ ! -x "\$bin" ]; then
  echo "$NAME: \$bin not found. Rebuild jot, or remove this command with:" >&2
  echo "  $REPO_ROOT/scripts/install-cli.sh --uninstall" >&2
  exit 1
fi
"\$bin" "\$@" >/dev/null 2>&1 &
EOF
  fi

  chmod +x "$TARGET"
}

remove_completion() {
  [[ -f "$ZSHRC" ]] || return 0

  local tmp
  tmp="$(mktemp)"
  awk \
    -v begin="$COMPLETION_BEGIN" \
    -v end="$COMPLETION_END" \
    -v legacy="$LEGACY_COMPLETION_COMMENT" \
    -v legacy_cmd="compdef _files $NAME" '
      $0 == begin { skipping = 1; next }
      skipping { if ($0 == end) skipping = 0; next }
      $0 == legacy { after_legacy = 1; next }
      after_legacy && $0 == legacy_cmd { after_legacy = 0; next }
      { after_legacy = 0; print }
    ' "$ZSHRC" > "$tmp"

  if ! cmp -s "$tmp" "$ZSHRC"; then
    # Write in place (rather than mv) to keep symlinks and permissions intact.
    cat "$tmp" > "$ZSHRC"
    echo "Removed zsh completion from $ZSHRC"
  fi
  rm -f "$tmp"
}

# macOS ships /usr/bin/jot, whose completion would otherwise shadow file names.
add_completion() {
  [[ "${SHELL:-}" == */zsh || -f "$ZSHRC" ]] || return 0

  remove_completion >/dev/null
  if [[ -s "$ZSHRC" && -n "$(tail -c 1 "$ZSHRC")" ]]; then
    echo >> "$ZSHRC"
  fi
  {
    echo "$COMPLETION_BEGIN"
    echo "(( \$+functions[compdef] )) && compdef _files $NAME"
    echo "$COMPLETION_END"
  } >> "$ZSHRC"
  echo "Added zsh completion to $ZSHRC"
}

# Warns if the new command won't be what the shell runs for $NAME.
check_path() {
  local dir index=0 bin_index=-1 system_index=-1
  local IFS=':'
  for dir in $PATH; do
    [[ "$dir" == "$BIN_DIR" && $bin_index -lt 0 ]] && bin_index=$index
    [[ -x "$dir/$NAME" && "$dir" != "$BIN_DIR" && $system_index -lt 0 ]] && system_index=$index
    index=$((index + 1))
  done

  if [[ $bin_index -lt 0 ]]; then
    echo
    echo "Note: $BIN_DIR is not on your PATH. Add this to $ZSHRC:"
    echo "  export PATH=\"$BIN_DIR:\$PATH\""
  elif [[ $system_index -ge 0 && $system_index -lt $bin_index ]]; then
    echo
    echo "Note: another '$NAME' comes earlier on your PATH and will run instead."
    echo "Move $BIN_DIR ahead of it, e.g. in $ZSHRC:"
    echo "  export PATH=\"$BIN_DIR:\$PATH\""
  fi
}

install() {
  local app
  if ! app="$(detect_app)"; then
    echo "Could not find the jot app." >&2
    echo "Install it into /Applications (or build it with 'npm run tauri build'), then re-run this script." >&2
    exit 1
  fi

  # Clear out wrappers from earlier installs, which may live in other directories.
  remove_wrappers
  if [[ -e "$TARGET" || -L "$TARGET" ]]; then
    echo "$TARGET already exists and wasn't installed by this script; leaving it alone." >&2
    echo "Remove it, or pick another location with --bin-dir." >&2
    exit 1
  fi
  write_wrapper "$app"
  add_completion

  echo
  echo "Installed $TARGET -> $app"
  echo "Open a new terminal (or run 'exec zsh'), then try: $NAME README.md"
  check_path
}

uninstall() {
  remove_wrappers
  remove_completion
  echo
  echo "Uninstalled the '$NAME' command."

  local app
  if app="$(detect_app)" && [[ "$app" == *.app ]]; then
    echo
    echo "The app itself is still at $app. To remove it, move it to the Trash."
    local dir data_dirs=()
    for dir in \
      "$HOME/Library/WebKit/$BUNDLE_ID" \
      "$HOME/Library/Caches/$BUNDLE_ID" \
      "$HOME/Library/Application Support/$BUNDLE_ID"; do
      if [[ -e "$dir" ]]; then
        data_dirs+=("$dir")
      fi
    done
    if [[ ${#data_dirs[@]} -gt 0 ]]; then
      echo "Its settings and caches live in:"
      printf '  %s\n' "${data_dirs[@]}"
    fi
  fi
}

"$ACTION"
