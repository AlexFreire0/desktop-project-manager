# Project Desk

Project Desk is a local-first Electron + React desktop workspace for developers who want projects, related folders, Git status, and repeatable commands in one calm interface.

## Highlights

- CRUD project library with descriptions, accent colors, favorites, search, filters, sorting, recent projects, and project parts/routes.
- Git status detection (branch, working tree changes, upstream sync) plus explicit actions for staging, committing, fetching, pulling, pushing, and managing branches.
- Open projects in VS Code (or another configured editor), the system file manager, or a terminal.
- Quick commands with CRUD, project association, working-directory overrides, reordering, confirmation, and direct `spawn` execution.
- Settings for editor/terminal defaults, hidden projects, card density, and command confirmations.
- Data is persisted as JSON in Electron's `app.getPath('userData')` directory. Writes use an atomic adjacent file replacement.
- Dark, responsive interface with loading, success, and error feedback.

## Run locally

Requires Node.js 18+ and npm.

```bash
npm install
npm run dev
```

The Vite renderer starts on `127.0.0.1:5173` and Electron opens the desktop window.

## Build and package

```bash
npm run build       # renderer + Electron main/preload
npm test            # Vitest test suite
npm run package     # electron-builder installer (platform-specific)
```

## OS notes and safety

- The editor setting accepts an executable command such as `code` or `cursor`, or an absolute path. On Windows, the default `code` value also checks the standard VS Code installation folders when the `code` command is not available on `PATH`.
- Terminal defaults use the OS default (`cmd.exe` on Windows, Terminal on macOS, and `x-terminal-emulator` on Linux) unless a command is configured.
- Git inspection is safe and read-only. Repository-changing actions (stage, commit, pull, push, checkout, and branch creation) only run after the user clicks the corresponding button; the app asks for confirmation before those actions.
- Quick commands use `child_process.spawn` with `shell: false`; executable names and arguments are passed separately to avoid shell interpolation. Project Desk does not run commands on startup or initialize/delete repositories.
- Packaging a Windows installer from another operating system (or vice versa) may require platform-specific signing and build tooling.
