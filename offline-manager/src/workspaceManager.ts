import * as fs from 'fs/promises';
import * as path from 'path';

// Data models from WORKPLAN - ensuring compatibility
export interface WorkspacesData {
  workspaces: Record<string, WorkspaceLayout>;
  active: string;
}

export interface WorkspaceLayout {
  main: LayoutComponent;
  left?: LayoutComponent;
  right?: LayoutComponent;
  active: string;
  mtime: string;
}

export interface LayoutComponent {
  id: string;
  type: "split" | "tabs" | "leaf";
  children?: LayoutComponent[];
  state?: LeafState;
  direction?: "horizontal" | "vertical";
  width?: number;
  collapsed?: boolean;
  currentTab?: number;
}

export interface LeafState {
  type: string;
  state: {
    file?: string;
    [key: string]: any;
  };
  icon?: string;
  title?: string;
}

export interface TabInfo {
  id: string;
  filePath: string;
  title: string;
}

export class WorkspaceManager {
    private vaultPath: string;
    private workspacesFilePath: string;
    private backupFolderPath: string;
    private transactionBackupPath: string | null = null;

    constructor(vaultPath: string) {
        this.vaultPath = vaultPath;
        this.workspacesFilePath = path.join(this.vaultPath, '.obsidian', 'workspaces.json');
        this.backupFolderPath = path.join(this.vaultPath, '.obsidian', 'backups');
    }

    // Read workspaces.json
    async getWorkspaces(): Promise<WorkspacesData> {
        try {
            const workspaceFile = await fs.readFile(this.workspacesFilePath, 'utf-8');
            return JSON.parse(workspaceFile);
        } catch (error) {
            console.error(`Could not read workspaces file for vault: ${this.vaultPath}`, error);
            // Return a default empty structure if file doesn't exist or is invalid
            return { workspaces: {}, active: '' };
        }
    }

    // Extract tabs from a workspace
    extractTabsFromWorkspace(workspace: WorkspaceLayout): TabInfo[] {
        const tabs: TabInfo[] = [];
        
        const extractFromNode = (node: LayoutComponent) => {
            if (node.type === 'leaf' && node.state?.state?.file) {
                tabs.push({
                    id: node.id,
                    filePath: node.state.state.file,
                    title: node.state.title || node.state.state.file.split('/').pop() || '',
                });
            } else if (node.children) {
                node.children.forEach(extractFromNode);
            }
        };
        
        if (workspace.main) {
            extractFromNode(workspace.main);
        }
        
        return tabs;
    }

    // --- Data Safety & File Operations ---

    private async ensureFolder(folderPath: string): Promise<void> {
        try {
            await fs.mkdir(folderPath, { recursive: true });
        } catch (error: any) {
            // Ignore error if folder already exists
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    private async createBackup(): Promise<string> {
        await this.ensureFolder(this.backupFolderPath);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `workspaces-backup-${timestamp}.json`;
        const backupPath = path.join(this.backupFolderPath, backupName);
        
        try {
            const currentContent = await fs.readFile(this.workspacesFilePath, 'utf-8');
            await fs.writeFile(backupPath, currentContent);
            return backupPath;
        } catch (error) {
            // If the original file doesn't exist, we can't back it up, but that's okay.
            console.warn('Could not create backup (original file may not exist):', error);
            return ''; // Return empty string if no backup was created
        }
    }

    private async writeAtomically(data: string): Promise<void> {
        const tempPath = `${this.workspacesFilePath}.tmp`;
        try {
            // Write to a temporary file first.
            await fs.writeFile(tempPath, data, 'utf-8');
            // Then, atomically rename it to the final destination.
            await fs.rename(tempPath, this.workspacesFilePath);
        } catch (error) {
            // If anything fails, try to clean up the temp file.
            try {
                await fs.unlink(tempPath);
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
            throw error;
        }
    }

    public async saveWorkspaces(workspacesData: WorkspacesData): Promise<void> {
        try {
            // This is the entry point for any write operation.
            // It ensures a backup is made before saving.
            await this.createBackup();
            
            const jsonString = JSON.stringify(workspacesData, null, 2);
            await this.writeAtomically(jsonString);
        } catch (error) {
            console.error('Failed to save workspaces:', error);
            throw error; // Re-throw to be handled by the caller
        }
    }

    // --- Workspace Manipulation ---

    private findTabRecursive(
        node: LayoutComponent,
        tabId: string,
        parent: LayoutComponent | null
    ): { found: LayoutComponent; parent: LayoutComponent } | null {
        if (node.id === tabId && node.type === 'leaf') {
            // This should not happen if the structure is valid, as the parent of a leaf is a 'tabs' or 'split'
            if (!parent) throw new Error('Found tab but it has no parent.');
            return { found: node, parent };
        }

        if (node.children) {
            for (const child of node.children) {
                const result = this.findTabRecursive(child, tabId, node);
                if (result) {
                    return result;
                }
            }
        }

        return null;
    }

    private removeTabRecursive(
        node: LayoutComponent,
        tabId: string
    ): boolean {
        if (!node.children) {
            return false;
        }

        const tabIndex = node.children.findIndex(child => child.id === tabId);
        if (tabIndex !== -1) {
            node.children.splice(tabIndex, 1);
            // If a 'tabs' container becomes empty, we could optionally remove it too, but for now, we'll leave it.
            return true;
        }

        // Recurse into children
        for (const child of node.children) {
            if (this.removeTabRecursive(child, tabId)) {
                return true;
            }
        }

        return false;
    }

    private findFirstTabsNode(node: LayoutComponent): LayoutComponent | null {
        if (node.type === 'tabs') {
            return node;
        }
        if (node.children) {
            for (const child of node.children) {
                const found = this.findFirstTabsNode(child);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    private addTabToWorkspace(workspace: WorkspaceLayout, tab: LayoutComponent): void {
        const targetNode = this.findFirstTabsNode(workspace.main);

        if (targetNode) {
            if (!targetNode.children) {
                targetNode.children = [];
            }
            targetNode.children.push(tab);
        } else {
            // Fallback: If no 'tabs' group exists, create one in the main split.
            if (workspace.main.type === 'split' && workspace.main.children) {
                workspace.main.children.push({
                    id: `tabs-${new Date().getTime()}`,
                    type: 'tabs',
                    children: [tab],
                });
            } else {
                console.error("Could not find a 'tabs' group or a 'split' to add the new tab to.");
            }
        }
    }

    public async moveTabsBetweenWorkspaces(
        sourceWorkspaceName: string,
        targetWorkspaceName: string,
        tabIds: string[]
    ): Promise<boolean> {
        const workspacesData = await this.getWorkspaces();
        const sourceWorkspace = workspacesData.workspaces[sourceWorkspaceName];
        const targetWorkspace = workspacesData.workspaces[targetWorkspaceName];

        if (!sourceWorkspace || !targetWorkspace) {
            throw new Error('Source or target workspace not found.');
        }

        for (const tabId of tabIds) {
            const tabInfo = this.findTabRecursive(sourceWorkspace.main, tabId, null);
            if (tabInfo) {
                this.removeTabRecursive(sourceWorkspace.main, tabId);
                this.addTabToWorkspace(targetWorkspace, tabInfo.found);
            }
        }
        
        // Update modification times
        sourceWorkspace.mtime = new Date().toISOString();
        targetWorkspace.mtime = new Date().toISOString();

        await this.saveWorkspaces(workspacesData);
        return true;
    }

    public async copyTabsBetweenWorkspaces(
        sourceWorkspaceName: string,
        targetWorkspaceName: string,
        tabIds: string[]
    ): Promise<boolean> {
        const workspacesData = await this.getWorkspaces();
        const sourceWorkspace = workspacesData.workspaces[sourceWorkspaceName];
        const targetWorkspace = workspacesData.workspaces[targetWorkspaceName];

        if (!sourceWorkspace || !targetWorkspace) {
            throw new Error('Source or target workspace not found.');
        }

        for (const tabId of tabIds) {
            const tabInfo = this.findTabRecursive(sourceWorkspace.main, tabId, null);
            if (tabInfo) {
                // Don't remove from source, just add to target
                this.addTabToWorkspace(targetWorkspace, tabInfo.found);
            }
        }

        targetWorkspace.mtime = new Date().toISOString();

        await this.saveWorkspaces(workspacesData);
        return true;
    }
}