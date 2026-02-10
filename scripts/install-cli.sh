#!/usr/bin/env bash
set -euo pipefail

NAME="${1:-jot}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ZSH_COMPLETION_SNIPPET='compdef _files jot'

detect_app_bin() {
  local candidates=(
    "/Applications/jot.app/Contents/MacOS/jot"
    "/Applications/Jot.app/Contents/MacOS/Jot"
    "$HOME/Applications/jot.app/Contents/MacOS/jot"
    "$HOME/Applications/Jot.app/Contents/MacOS/Jot"
    "$REPO_ROOT/src-tauri/target/release/jot"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

pick_bin_dir() {
  local dir
  IFS=':' read -r -a path_parts <<< "${PATH:-}"
  for dir in "${path_parts[@]}"; do
    [[ -z "$dir" ]] && continue
    if [[ "$dir" == "/usr/bin" ]]; then
      continue
    fi
    if [[ -d "$dir" && -w "$dir" ]]; then
      echo "$dir"
      return 0
    fi
  done

  local fallback="$HOME/.local/bin"
  mkdir -p "$fallback"
  echo "$fallback"
}

ensure_zsh_completion() {
  local zshrc="$HOME/.zshrc"

  if [[ ! -f "$zshrc" ]]; then
    touch "$zshrc"
  fi

  if ! grep -Fq "$ZSH_COMPLETION_SNIPPET" "$zshrc"; then
    {
      echo
      echo "# jot CLI: complete file paths for the app command."
      echo "$ZSH_COMPLETION_SNIPPET"
    } >> "$zshrc"
    echo "Added zsh completion override to $zshrc"
  fi
}

if ! APP_BIN="$(detect_app_bin)"; then
  echo "Could not find a jot app binary."
  echo "Expected one of:"
  echo "  /Applications/jot.app/Contents/MacOS/jot"
  echo "  /Applications/Jot.app/Contents/MacOS/Jot"
  echo "Install jot first, then re-run this script."
  exit 1
fi

BIN_DIR="$(pick_bin_dir)"
TARGET="$BIN_DIR/$NAME"

cat > "$TARGET" <<EOF
#!/usr/bin/env sh
exec "$APP_BIN" "\$@"
EOF

chmod +x "$TARGET"
hash -r 2>/dev/null || true
ensure_zsh_completion

echo "Installed CLI wrapper: $TARGET"
echo "App binary: $APP_BIN"
echo
echo "Test it:"
echo "  $NAME --help"
echo "  $NAME README.md"
echo
echo "Resolution check:"
echo "  which -a $NAME"
echo "  source ~/.zshrc"
echo "  compdef | grep -E '^jot='"

if ! command -v "$NAME" >/dev/null 2>&1; then
  echo
  echo "Note: '$BIN_DIR' is not currently on your PATH."
  echo "Add this to your shell config (~/.zshrc):"
  echo "  export PATH=\"$BIN_DIR:\$PATH\""
elif [[ "$(command -v "$NAME")" != "$TARGET" ]]; then
  echo
  echo "Note: '$NAME' currently resolves to: $(command -v "$NAME")"
  echo "Put '$BIN_DIR' before '/usr/bin' in PATH if you want this wrapper by default."
fi
