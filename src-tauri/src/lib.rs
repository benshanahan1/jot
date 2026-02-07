use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .menu(|app| {
            #[cfg(target_os = "macos")]
            let app_menu = Submenu::with_items(
                app,
                "Jot",
                true,
                &[
                    &PredefinedMenuItem::about(app, None, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::show_all(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?;

            let file_new = MenuItem::with_id(app, "file.new", "New", true, Some("CmdOrCtrl+N"))?;
            let file_open = MenuItem::with_id(app, "file.open", "Open...", true, Some("CmdOrCtrl+O"))?;
            let file_save = MenuItem::with_id(app, "file.save", "Save", true, Some("CmdOrCtrl+S"))?;
            let file_save_as =
                MenuItem::with_id(app, "file.save_as", "Save As...", true, Some("CmdOrCtrl+Shift+S"))?;
            let file_rename =
                MenuItem::with_id(app, "file.rename", "Rename...", true, Some("CmdOrCtrl+Shift+R"))?;

            let edit_undo = PredefinedMenuItem::undo(app, None)?;
            let edit_redo = PredefinedMenuItem::redo(app, None)?;
            let edit_cut = PredefinedMenuItem::cut(app, None)?;
            let edit_copy = PredefinedMenuItem::copy(app, None)?;
            let edit_paste = PredefinedMenuItem::paste(app, None)?;
            let edit_select_all = PredefinedMenuItem::select_all(app, None)?;

            let view_width_narrow =
                MenuItem::with_id(app, "view.width.narrow", "Narrow Width", true, None::<&str>)?;
            let view_width_wide =
                MenuItem::with_id(app, "view.width.wide", "Wide Width", true, None::<&str>)?;
            let view_zoom_in =
                MenuItem::with_id(app, "view.zoom_in", "Zoom In", true, Some("CmdOrCtrl+="))?;
            let view_zoom_out =
                MenuItem::with_id(app, "view.zoom_out", "Zoom Out", true, Some("CmdOrCtrl+-"))?;
            let view_zoom_reset =
                MenuItem::with_id(app, "view.zoom_reset", "Actual Size", true, Some("CmdOrCtrl+0"))?;
            let view_font_serif =
                MenuItem::with_id(app, "view.font.serif", "Serif Font", true, None::<&str>)?;
            let view_font_sans =
                MenuItem::with_id(app, "view.font.sans", "Sans Font", true, None::<&str>)?;
            let view_font_mono =
                MenuItem::with_id(app, "view.font.mono", "Mono Font", true, None::<&str>)?;
            let view_theme_system =
                MenuItem::with_id(app, "view.theme.system", "Theme: System", true, None::<&str>)?;
            let view_theme_light =
                MenuItem::with_id(app, "view.theme.light", "Theme: Light", true, None::<&str>)?;
            let view_theme_dark =
                MenuItem::with_id(app, "view.theme.dark", "Theme: Dark", true, None::<&str>)?;

            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &file_new,
                    &file_open,
                    &file_save,
                    &file_save_as,
                    &PredefinedMenuItem::separator(app)?,
                    &file_rename,
                    &PredefinedMenuItem::close_window(app, None)?,
                ],
            )?;

            let edit_menu = Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &edit_undo,
                    &edit_redo,
                    &PredefinedMenuItem::separator(app)?,
                    &edit_cut,
                    &edit_copy,
                    &edit_paste,
                    &PredefinedMenuItem::separator(app)?,
                    &edit_select_all,
                ],
            )?;

            let view_menu = Submenu::with_items(
                app,
                "View",
                true,
                &[
                    &view_font_serif,
                    &view_font_sans,
                    &view_font_mono,
                    &PredefinedMenuItem::separator(app)?,
                    &view_width_narrow,
                    &view_width_wide,
                    &PredefinedMenuItem::separator(app)?,
                    &view_zoom_in,
                    &view_zoom_out,
                    &view_zoom_reset,
                    &PredefinedMenuItem::separator(app)?,
                    &view_theme_system,
                    &view_theme_light,
                    &view_theme_dark,
                ],
            )?;

            let window_menu = Submenu::with_items(
                app,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(app, None)?,
                    &PredefinedMenuItem::maximize(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::close_window(app, None)?,
                ],
            )?;

            let help_docs = MenuItem::with_id(app, "help.docs", "Writing Tips", true, None::<&str>)?;
            let help_menu = Submenu::with_items(app, "Help", true, &[&help_docs])?;

            #[cfg(target_os = "macos")]
            {
                Menu::with_items(
                    app,
                    &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu, &help_menu],
                )
            }

            #[cfg(not(target_os = "macos"))]
            {
                Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])
            }
        })
        .on_menu_event(|app, event| {
            let event_id = event.id().as_ref();
            if matches!(
                event_id,
                "file.new"
                    | "file.open"
                    | "file.save"
                    | "file.save_as"
                    | "file.rename"
                    | "view.width.narrow"
                    | "view.width.wide"
                    | "view.zoom_in"
                    | "view.zoom_out"
                    | "view.zoom_reset"
                    | "view.theme.system"
                    | "view.theme.light"
                    | "view.theme.dark"
                    | "view.font.serif"
                    | "view.font.sans"
                    | "view.font.mono"
                    | "help.docs"
            ) {
                let _ = app.emit("menu-action", event_id.to_string());
            }
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
