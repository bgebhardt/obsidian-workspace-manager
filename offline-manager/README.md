# Obsidian Offline Workspace Manager

A standalone desktop application to safely edit Obsidian workspace configurations when the main Obsidian application is closed. This tool allows you to move, copy, and delete tabs between workspaces within a vault.

## Features

- **Automatic Vault Detection:** Finds all your Obsidian vaults automatically.
- **Workspace Management:** View all workspaces within a vault and the tabs they contain.
- **Tab Operations:**
    - Move tabs from one workspace to another.
    - Copy tabs from one workspace to another.
    - Delete tabs from a workspace.
- **Safety First:**
    - Detects if Obsidian is running and provides a warning.
    - On macOS, shows which vaults are open and provides a button to quit Obsidian remotely.
    - Creates automatic, timestamped backups of your `workspaces.json` file before any changes are made.
    - Uses a transaction system to automatically restore from a backup if an error occurs.
- **Convenience:**
    - Provides a button to open the selected vault directly in Obsidian.

## How It Works

This project is an [Electron](https://www.electronjs.org/) application that wraps a Node.js backend and a Vite-powered frontend.

-   **Backend:** A Node.js / Express server handles all file system operations, such as reading your vault configurations, finding workspaces, and safely modifying the `workspaces.json` file.
-   **Frontend:** A Vite-powered single-page web application that provides the user interface.
-   **Electron Shell:** Wraps the backend and frontend into a native desktop application.

## Setup and Installation

The project requires Node.js. After cloning the repository, install all dependencies for the backend, frontend, and Electron app with a single command from the root `offline-manager` directory:

```bash
npm install
```
This will also automatically run `npm install` in the `frontend` directory for you.

## Running for Development

To run the application in development mode, use the integrated script from the root `offline-manager` directory. This will start the backend server, the frontend dev server, and the Electron app all at once.

```bash
npm run electron-dev
```

## Building the Application

To build a distributable, production-ready version of the application for your operating system:

1.  **Build the code:**
    This command compiles the backend and frontend code into optimized files ready for packaging.
    ```bash
    npm run build
    ```

2.  **Package the application:**
    This command takes the built files and packages them into a single, installable application file (e.g., `.dmg` on macOS, `.exe` on Windows).
    ```bash
    npm run dist
    ```
    The final application file will be located in the `offline-manager/release` directory.