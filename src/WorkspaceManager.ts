import { App, Notice, Plugin } from 'obsidian';
import { WorkspacesData, WorkspaceLayout, LayoutComponent, TabInfo } from './types';

export class WorkspaceManager {
    private transactionBackupPath: string | null = null;

    constructor(private app: App, private plugin: Plugin) {}

    // Read workspaces.json
    async getWorkspaces(): Promise<WorkspacesData> {
        try {
            const workspaceFile = await this.app.vault.adapter.read('.obsidian/workspaces.json');
            return JSON.parse(workspaceFile);
        } catch (error) {
            new Notice('Could not read workspaces file');
            console.error(error);
            return { workspaces: {}, active: '' };
        }
    }

    // Save workspaces.json with backup
    async saveWorkspaces(workspacesData: WorkspacesData): Promise<void> {
        try {
            // Create backup first
            await this.createBackup();

            const jsonString = JSON.stringify(workspacesData, null, 2);
            await this.writeAtomically('.obsidian/workspaces.json', jsonString);

            new Notice('Workspaces updated successfully');
        } catch (error) {
            new Notice('Failed to save workspaces');
            console.error(error);
            throw error;
        }
    }

    // Create a backup of workspaces.json
    async createBackup(): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        // @ts-ignore
        const backupFolder = this.plugin.settings.backupLocation || '.obsidian/backups';
        const backupName = `${backupFolder}/workspaces-backup-${timestamp}.json`;

        try {
            // Ensure backup folder exists
            await this.ensureFolder(backupFolder);

            // Create backup
            const currentWorkspaces = await this.app.vault.adapter.read('.obsidian/workspaces.json');
            await this.app.vault.adapter.write(backupName, currentWorkspaces);

            // Prune old backups
            await this.pruneOldBackups();

            return backupName;
        } catch (error) {
            console.warn('Could not create backup:', error);
            throw error;
        }
    }

    // Extract tabs from a workspace
    extractTabsFromWorkspace(workspace: WorkspaceLayout): TabInfo[] {
        const tabs: TabInfo[] = [];

        // Recursively extract tabs from Obsidian's layout structure
        const extractFromNode = (node: LayoutComponent) => {
            if (node.type === 'leaf' && node.state?.state?.file) {
                tabs.push({
                    id: node.id,
                    workspaceName: '',
                    filePath: node.state.state.file,
                    title: node.state.title || node.state.state.file.split('/').pop() || '',
                    type: node.state.type || 'markdown',
                    icon: node.state.icon
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

    // Move tabs between workspaces
    async moveTabsBetweenWorkspaces(
        sourceWorkspaceName: string,
        targetWorkspaceName: string,
        tabIds: string[]
    ): Promise<boolean> {
        try {
            // Begin transaction
            await this.beginTransaction();

            // Load workspaces
            const workspacesData = await this.getWorkspaces();

            // Validate workspaces exist
            if (!workspacesData.workspaces[sourceWorkspaceName] ||
                !workspacesData.workspaces[targetWorkspaceName]) {
                throw new Error('Source or target workspace not found');
            }

            // Find tabs in source workspace
            const sourceWorkspace = workspacesData.workspaces[sourceWorkspaceName];
            const targetWorkspace = workspacesData.workspaces[targetWorkspaceName];

            const tabsToMove: LayoutComponent[] = [];

            // For each tab to move, find it and prepare for moving
            for (const tabId of tabIds) {
                const tabInfo = this.findTabInWorkspace(sourceWorkspace, tabId);
                if (tabInfo) {
                    tabsToMove.push(tabInfo.tab);
                } else {
                    console.warn(`Tab ${tabId} not found in workspace ${sourceWorkspaceName}`);
                }
            }

            // Remove all found tabs from the source workspace
            for (const tabId of tabsToMove.map(t => t.id)) {
                this.removeTabFromWorkspace(sourceWorkspace, tabId);
            }

            // Add tabs to the target workspace
            for (const tab of tabsToMove) {
                this.addTabToWorkspace(targetWorkspace, tab);
            }

            // Update timestamps
            sourceWorkspace.mtime = new Date().toISOString();
            targetWorkspace.mtime = new Date().toISOString();

            // Save changes
            await this.saveWorkspaces(workspacesData);

            // Commit transaction
            await this.commitTransaction();

            return true;
        } catch (error) {
            // Rollback on error
            await this.rollbackTransaction();
            console.error('Failed to move files:', error);
            new Notice(`Failed to move files: ${(error as Error).message}`);
            return false;
        }
    }

    async deleteTabsFromWorkspace(workspaceName: string, tabIds: string[]): Promise<boolean> {
        try {
            await this.beginTransaction();
            const workspacesData = await this.getWorkspaces();

            if (!workspacesData.workspaces[workspaceName]) {
                throw new Error('Workspace not found');
            }

            const workspace = workspacesData.workspaces[workspaceName];
            let tabsDeleted = 0;

            for (const tabId of tabIds) {
                if (this.removeTabFromWorkspace(workspace, tabId)) {
                    tabsDeleted++;
                } else {
                    console.warn(`Tab ${tabId} not found in workspace ${workspaceName}`);
                }
            }

            if (tabsDeleted > 0) {
                workspace.mtime = new Date().toISOString();
                await this.saveWorkspaces(workspacesData);
            }

            await this.commitTransaction();
            return true;

        } catch (error) {
            await this.rollbackTransaction();
            console.error('Failed to delete tabs:', error);
            new Notice(`Failed to delete tabs: ${(error as Error).message}`);
            return false;
        }
    }

    // Transaction methods
    async beginTransaction(): Promise<void> {
        // Create a backup before starting transaction
        this.transactionBackupPath = await this.createBackup();
    }

    async commitTransaction(): Promise<void> {
        // Clear the transaction backup
        this.transactionBackupPath = null;
    }

    async rollbackTransaction(): Promise<void> {
        if (!this.transactionBackupPath) {
            console.warn('No transaction backup to restore');
            return;
        }

        try {
            // Restore from backup
            const backupContent = await this.app.vault.adapter.read(this.transactionBackupPath);
            await this.app.vault.adapter.write('.obsidian/workspaces.json', backupContent);
            this.transactionBackupPath = null;
        } catch (error) {
            console.error('Failed to rollback transaction:', error);
            throw new Error(`Failed to rollback: ${(error as Error).message}`);
        }
    }

    // Utility methods
    private findTabInWorkspace(workspace: WorkspaceLayout, tabId: string): { tab: LayoutComponent, parent: LayoutComponent } | null {
        const find = (node: LayoutComponent): { tab: LayoutComponent, parent: LayoutComponent } | null => {
            if (node.children) {
                for (const child of node.children) {
                    if (child.id === tabId && child.type === 'leaf') {
                        return { tab: child, parent: node };
                    }
                    const found = find(child);
                    if (found) {
                        return found;
                    }
                }
            }
            return null;
        };
        return find(workspace.main);
    }

    private removeTabFromWorkspace(workspace: WorkspaceLayout, tabId: string): boolean {
        const tabInfo = this.findTabInWorkspace(workspace, tabId);
        if (tabInfo && tabInfo.parent && tabInfo.parent.children) {
            tabInfo.parent.children = tabInfo.parent.children.filter(child => child.id !== tabId);

            // If a split is now empty, remove it
            if (tabInfo.parent.children.length === 0 && tabInfo.parent.type === 'split') {
                // This is complex, for now we leave empty splits.
                // A more robust solution would be to recursively clean up empty parents.
            }
            return true;
        }
        return false;
    }

    private addTabToWorkspace(workspace: WorkspaceLayout, tab: LayoutComponent): void {
        const findFirstTabGroup = (node: LayoutComponent): LayoutComponent | null => {
            if (node.type === 'tabs') {
                return node;
            }
            if (node.children) {
                for (const child of node.children) {
                    const found = findFirstTabGroup(child);
                    if (found) return found;
                }
            }
            return null;
        };

        let targetTabs = findFirstTabGroup(workspace.main);

        if (!targetTabs) {
            // If no tab group exists, create one at the root.
            if (workspace.main.type !== 'split' || !workspace.main.children) {
                // If main is not a split, we have to make it one.
                const originalMain = { ...workspace.main };
                workspace.main.type = 'split';
                workspace.main.direction = 'vertical';
                workspace.main.children = [originalMain];
            }
            targetTabs = {
                id: `tabs-${Date.now()}`,
                type: 'tabs',
                children: []
            };
            workspace.main.children.push(targetTabs);
        }

        if (!targetTabs.children) {
            targetTabs.children = [];
        }
        targetTabs.children.push(tab);
    }

    private async writeAtomically(path: string, data: string): Promise<void> {
        const tempPath = `${path}.tmp`;

        try {
            // Write to temporary file first
            await this.app.vault.adapter.write(tempPath, data);

            // Validate the written data
            const writtenData = await this.app.vault.adapter.read(tempPath);
            this.validateData(writtenData, data);

            // Create backup of original file if it exists
            if (await this.app.vault.adapter.exists(path)) {
                const backupPath = `${path}.bak`;
                const originalData = await this.app.vault.adapter.read(path);
                await this.app.vault.adapter.write(backupPath, originalData);
            }

            // Rename temp file to target file
            if (await this.app.vault.adapter.exists(path)) {
                await this.app.vault.adapter.remove(path);
            }
            await this.app.vault.adapter.rename(tempPath, path);

        } catch (error) {
            // Clean up temp file if it exists
            if (await this.app.vault.adapter.exists(tempPath)) {
                await this.app.vault.adapter.remove(tempPath);
            }

            throw error;
        }
    }

    private validateData(written: string, expected: string): void {
        // Simple validation - check if the written data is valid JSON
        try {
            JSON.parse(written);
        } catch (error) {
            throw new Error(`Data validation failed: ${(error as Error).message}`);
        }
    }

    private async ensureFolder(path: string): Promise<void> {
        if (!(await this.app.vault.adapter.exists(path))) {
            await this.app.vault.adapter.mkdir(path);
        }
    }

    private async pruneOldBackups(): Promise<void> {
        // @ts-ignore
        const backupFolder = this.plugin.settings.backupLocation || '.obsidian/backups';
        // @ts-ignore
        const maxBackups = this.plugin.settings.maxBackups || 10;

        try {
            const { files } = await this.app.vault.adapter.list(backupFolder);
            const backupFiles = files
                .filter(file => file.endsWith('.json'))
                .sort((a, b) => {
                    // Sort by timestamp (newest first)
                    const timestampA = a.match(/workspaces-backup-(.+)\.json$/)?.[1] || '';
                    const timestampB = b.match(/workspaces-backup-(.+)\.json$/)?.[1] || '';
                    return timestampB.localeCompare(timestampA);
                });

            // Remove oldest backups if we exceed the limit
            if (backupFiles.length > maxBackups) {
                const filesToRemove = backupFiles.slice(maxBackups);
                for (const file of filesToRemove) {
                    await this.app.vault.adapter.remove(`${backupFolder}/${file}`);
                }
            }
        } catch (error) {
            console.warn('Failed to prune old backups:', error);
        }
    }
}