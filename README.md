<div align="center">

# jot

**A minimalist markdown editor for macOS, Windows, and Linux**

<img src="demo.png" alt="Jot Screenshot" width="800">

*Clean, distraction-free writing with live markdown rendering*

[![Release](https://img.shields.io/github/v/release/benshanahan1/jot)](https://github.com/benshanahan1/jot/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/benshanahan1/jot/test.yml?branch=main)](https://github.com/benshanahan1/jot/actions)
[![License](https://img.shields.io/github/license/benshanahan1/jot)](LICENSE)

[Download](https://github.com/benshanahan1/jot/releases) · [Report Bug](https://github.com/benshanahan1/jot/issues) · [Request Feature](https://github.com/benshanahan1/jot/issues)

</div>

---

## ✨ Features

- **Minimalist Design** - Distraction-free interface focused on your writing
- **Live Markdown** - Real-time rendering as you type
- **Cross-Platform** - Available for macOS, Windows, and Linux
- **Customizable** - Multiple fonts (serif, sans, mono), themes (light/dark), and text scaling
- **Fast & Lightweight** - Built with Tauri and React for optimal performance
- **File Management** - Open, save, and rename markdown files with ease
- **Keyboard Shortcuts** - Efficient workflow with comprehensive hotkeys

## 📦 Installation

Download the latest release for your platform:

- **macOS**: Download the `.dmg` file
- **Linux**: Download the `.deb` or `.AppImage` file
- **Windows**: Download the `.msi` installer

[**→ Get the latest release**](https://github.com/benshanahan1/jot/releases/latest)

## 🚀 Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later)
- [Rust](https://rustup.rs/)
- [Bun](https://bun.sh/) (optional, for faster builds)

### Setup

```bash
# Clone the repository
git clone https://github.com/benshanahan1/jot.git
cd jot

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Backend**: Tauri (Rust)
- **Editor**: Milkdown (Markdown rendering)
- **Testing**: Vitest

## ⌨️ Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| New File | `Cmd+N` | `Ctrl+N` |
| Open File | `Cmd+O` | `Ctrl+O` |
| Save | `Cmd+S` | `Ctrl+S` |
| Save As | `Cmd+Shift+S` | `Ctrl+Shift+S` |
| Zoom In | `Cmd+=` | `Ctrl+=` |
| Zoom Out | `Cmd+-` | `Ctrl+-` |
| Reset Zoom | `Cmd+0` | `Ctrl+0` |

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/)
- Markdown editing powered by [Milkdown](https://milkdown.dev/)
- Icon design inspired by minimalist writing tools

---

<div align="center">

Made with ❤️ by [Ben Shanahan](https://github.com/benshanahan1)

</div>
