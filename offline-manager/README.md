# Obsidian Offline Workspace Manager

A standalone local web application to safely edit Obsidian workspace configurations when the main Obsidian application is closed. This tool allows you to move and copy tabs between workspaces within a vault.

## How It Works

This project consists of two main parts:

1.  **Backend:** A Node.js / Express server that handles all file system operations, such as reading your vault configurations, finding workspaces, and safely modifying the `workspaces.json` file.
2.  **Frontend:** A Vite-powered single-page web application that provides the user interface for managing your workspaces.

## Setup and Installation

1.  **Install Backend Dependencies:**
    Navigate to the root `offline-manager` directory and run:
    ```bash
    npm install
    ```

2.  **Install Frontend Dependencies:**
    Navigate to the `frontend` subdirectory and run:
    ```bash
    cd frontend
    npm install
    ```

## Running the Application

You must have both the backend and frontend servers running simultaneously in two separate terminals.

1.  **Start the Backend Server:**
    In the root `offline-manager` directory, run:
    ```bash
    npm run dev
    ```
    The backend will start on `http://localhost:5005`.

2.  **Start the Frontend Server:**
    In the `offline-manager/frontend` directory, run:
    ```bash
    npm run dev
    ```
    The frontend will start on a different port (usually `http://localhost:5173`) and will automatically open in your browser.

Once both servers are running, you can use the application in your browser to manage your workspaces.