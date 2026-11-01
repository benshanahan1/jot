use std::{
    ffi::OsString,
    path::{Path, PathBuf},
    sync::Mutex,
};

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, MenuItemKind, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Manager, RunEvent, Runtime, State,
};
use tauri_plugin_fs::FsExt;

/// Files the command line, a second `jot` launch, or Finder asked us to open, held until the
/// frontend claims them.
#[derive(Default)]
struct PendingFiles(Mutex<Vec<PathBuf>>);

impl PendingFiles {
    fn push<R: Runtime>(&self, app: &AppHandle<R>, paths: Vec<PathBuf>) {
        if paths.is_empty() {
            return;
        }
        self.0.lock().unwrap().extend(paths);
        let _ = app.emit("pending-files", ());
    }
}

fn paths_from_args(args: impl IntoIterator<Item = impl Into<OsString>>, cwd: &Path) -> Vec<PathBuf> {
    args.into_iter()
        .map(Into::into)
        .filter(|arg| !arg.to_string_lossy().starts_with('-'))
        .map(|arg| cwd.join(arg)) // `join` keeps absolute paths as they are.
        .collect()
}

/// Grants the frontend access to `path`'s directory, which may be outside the directories in
/// capabilities/default.json (e.g. `jot /tmp/notes.md`). The whole directory, not just the file,
/// so renaming the file in place also works.
fn allow_fs_access<R: Runtime>(app: &AppHandle<R>, path: &Path) {
    if let Some(parent) = path.parent() {
        if let Err(error) = app.fs_scope().allow_directory(parent, false) {
            eprintln!("failed to allow access to {}: {error}", parent.display());
        }
    }
}

fn focus_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Returns (and forgets) the files waiting to be opened.
#[tauri::command]
fn take_pending_files(app: AppHandle, pending: State<PendingFiles>) -> Vec<String> {
    let paths = std::mem::take(&mut *pending.0.lock().unwrap());
    paths
        .iter()
        .map(|path| {
            allow_fs_access(&app, path);
            path.to_string_lossy().into_owned()
        })
        .collect()
}

/// Checks exactly the View menu items in `checked`, e.g. the current theme and font.
#[tauri::command]
fn sync_view_menu(app: AppHandle, checked: Vec<String>) {
    fn visit<R: Runtime>(items: Vec<MenuItemKind<R>>, checked: &[String]) {
        for item in items {
            match item {
                MenuItemKind::Check(item) => {
                    let _ = item.set_checked(checked.iter().any(|id| id == item.id().as_ref()));
                }
                MenuItemKind::Submenu(submenu) => visit(submenu.items().unwrap_or_default(), checked),
                _ => {}
            }
        }
    }

    if let Some(menu) = app.menu() {
        visit(menu.items().unwrap_or_default(), &checked);
    }
}

// Every custom item has an id the frontend handles (see menuActions in src/App.tsx) and a
// shortcut, shown next to it in the menu.
fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let item = |id: &str, label: &str, shortcut: &str| {
        MenuItem::with_id(app, id, label, true, Some(shortcut))
    };
    let check = |id: &str, label: &str, shortcut: &str| {
        CheckMenuItem::with_id(app, id, label, true, false, Some(shortcut))
    };
    let separator = || PredefinedMenuItem::separator(app);

    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &item("file.new", "New Tab", "CmdOrCtrl+N")?,
            &item("file.open", "Open...", "CmdOrCtrl+O")?,
            &separator()?,
            &item("file.save", "Save", "CmdOrCtrl+S")?,
            &item("file.save_as", "Save As...", "CmdOrCtrl+Shift+S")?,
            &item("file.rename", "Rename...", "CmdOrCtrl+Shift+R")?,
            &separator()?,
            &item("file.close_tab", "Close Tab", "CmdOrCtrl+W")?,
            &item("file.close_window", "Close Window", "CmdOrCtrl+Shift+W")?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &separator()?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &separator()?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let theme_menu = Submenu::with_items(
        app,
        "Theme",
        true,
        &[
            &check("view.theme.system", "System", "Alt+CmdOrCtrl+1")?,
            &check("view.theme.light", "Light", "Alt+CmdOrCtrl+2")?,
            &check("view.theme.dark", "Dark", "Alt+CmdOrCtrl+3")?,
        ],
    )?;

    let font_menu = Submenu::with_items(
        app,
        "Font",
        true,
        &[
            &check("view.font.serif", "Serif", "Alt+CmdOrCtrl+4")?,
            &check("view.font.sans", "Sans", "Alt+CmdOrCtrl+5")?,
            &check("view.font.mono", "Mono", "Alt+CmdOrCtrl+6")?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &theme_menu,
            &font_menu,
            &check("view.wide", "Wide Layout", "CmdOrCtrl+\\")?,
            &separator()?,
            &item("view.zoom_in", "Zoom In", "CmdOrCtrl+=")?,
            &item("view.zoom_out", "Zoom Out", "CmdOrCtrl+-")?,
            &item("view.zoom_reset", "Actual Size", "CmdOrCtrl+0")?,
        ],
    )?;

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &item("window.next_tab", "Show Next Tab", "CmdOrCtrl+Shift+]")?,
            &item("window.previous_tab", "Show Previous Tab", "CmdOrCtrl+Shift+[")?,
            &separator()?,
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
        ],
    )?;

    let help_menu = Submenu::with_items(
        app,
        "Help",
        true,
        &[&MenuItem::with_id(app, "help.docs", "Writing Tips", true, None::<&str>)?],
    )?;

    #[cfg(target_os = "macos")]
    {
        let app_menu = Submenu::with_items(
            app,
            "jot",
            true,
            &[
                &PredefinedMenuItem::about(app, None, None)?,
                &separator()?,
                &PredefinedMenuItem::hide(app, None)?,
                &PredefinedMenuItem::hide_others(app, None)?,
                &PredefinedMenuItem::show_all(app, None)?,
                &separator()?,
                // Not PredefinedMenuItem::quit, which exits immediately without letting the
                // frontend ask about unsaved changes.
                &item("app.quit", "Quit jot", "CmdOrCtrl+Q")?,
            ],
        )?;
        Menu::with_items(
            app,
            &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu, &help_menu],
        )
    }

    #[cfg(not(target_os = "macos"))]
    Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])
}

fn handle_run_event<R: Runtime>(app: &AppHandle<R>, event: RunEvent) {
    // Finder delivers double-clicked and "Open With" files as an event rather than argv.
    #[cfg(target_os = "macos")]
    if let RunEvent::Opened { urls } = event {
        let paths = urls.into_iter().filter_map(|url| url.to_file_path().ok()).collect();
        app.state::<PendingFiles>().push(app, paths);
        focus_main_window(app);
    }

    #[cfg(not(target_os = "macos"))]
    let _ = (app, event);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cwd = std::env::current_dir().unwrap_or_default();
    let pending = PendingFiles::default();
    pending.0.lock().unwrap().extend(paths_from_args(std::env::args_os().skip(1), &cwd));

    let mut builder = tauri::Builder::default();

    // A second `jot file.md` hands its files to the running app (as new tabs) and exits.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let paths = paths_from_args(argv.into_iter().skip(1), Path::new(&cwd));
            app.state::<PendingFiles>().push(app, paths);
            focus_main_window(app);
        }));
    }

    builder
        .manage(pending)
        .menu(build_menu)
        // Forward custom item ids (e.g. "file.save") to the frontend, which ignores unknown ids.
        .on_menu_event(|app, event| {
            let _ = app.emit("menu-action", event.id().as_ref());
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![take_pending_files, sync_view_menu])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(handle_run_event);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_file_args_against_cwd() {
        let cwd = Path::new("/work");
        let paths = paths_from_args(["notes.md", "--flag", "/abs/a.md", "sub/b.md"], cwd);
        assert_eq!(
            paths,
            [
                PathBuf::from("/work/notes.md"),
                PathBuf::from("/abs/a.md"),
                PathBuf::from("/work/sub/b.md"),
            ]
        );
    }
}
