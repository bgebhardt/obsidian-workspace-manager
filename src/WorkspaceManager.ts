import { App, Notice } from 'obsidian';
import { WorkspacesData, WorkspaceLayout, LayoutComponent, TabInfo, WorkspaceManagerSettings } from './types';
import { Logger } from './Logger';

export class WorkspaceManager {
    private transactionBackupPath: string | null = null;

    constructor(private app: App, private settings: WorkspaceManagerSettings) {}

    // Read workspaces.json
    async getWorkspaces(): Promise<WorkspacesData> {
        try {
            Logger.debug('Reading workspaces file');
            const workspaceFile = await this.app.vault.adapter.read('.obsidian/workspaces.json');
            const workspacesData = JSON.parse(workspaceFile);
            Logger.debug('Workspaces data loaded:', workspacesData);
            return workspacesData;
        } catch (error) {
            new Notice('Could not read workspaces file');
            Logger.error('Could not read workspaces file', error);
            return { workspaces: {}, active: '' };
        }
    }

    // Save workspaces.json with backup
    async saveWorkspaces(workspacesData: WorkspacesData): Promise<void> {
        try {
            // Create backup first
            await this.createBackup();
            Logger.debug('Saving workspaces data:', workspacesData);
            const jsonString = JSON.stringify(workspacesData, null, 2);
            await this.writeAtomically('.obsidian/workspaces.json', jsonString);

            new Notice('Workspaces updated successfully');
        } catch (error) {
            new Notice('Failed to save workspaces');
            Logger.error('Failed to save workspaces', error);
            throw error;
        }
    }

    // Create a backup of workspaces.json
    async createBackup(): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFolder = this.settings.backupLocation || '.obsidian/backups';
        const backupName = `${backupFolder}/workspaces-backup-${timestamp}.json`;

        try {
            // Ensure backup folder exists
            await this.ensureFolder(backupFolder);
            Logger.debug(`Creating backup at ${backupName}`);
            // Create backup
            const currentWorkspaces = await this.app.vault.adapter.read('.obsidian/workspaces.json');
            await this.app.vault.adapter.write(backupName, currentWorkspaces);

            // Prune old backups
            await this.pruneOldBackups();

            return backupName;
        } catch (error) {
            Logger.warn('Could not create backup:', error);
            throw error;
        }
    }

    // Extract tabs from a workspace
    extractTabsFromWorkspace(workspace: WorkspaceLayout): TabInfo[] {
        Logger.debug('Extracting tabs from workspace:', workspace);
        const tabs: TabInfo[] = [];

        // Recursively extract tabs from Obsidian's layout structure
        const extractFromNode = (node: LayoutComponent) => {
            if (node.type === 'leaf' && node.state?.state?.file) {
                const tabInfo = {
                    id: node.id,
                    workspaceName: '',
                    filePath: node.state.state.file,
                    title: node.state.title || node.state.state.file.split('/').pop() || '',
                    type: node.state.type || 'markdown',
                    icon: node.state.icon
                };
                tabs.push(tabInfo);
                Logger.debug('Found tab:', tabInfo);
            } else if (node.children) {
                node.children.forEach(extractFromNode);
            }
        };

        if (workspace.main) {
            extractFromNode(workspace.main);
        }
        Logger.debug('Extracted tabs:', tabs);
        return tabs;
    }

    // Move tabs between workspaces
    async moveTabsBetweenWorkspaces(
        sourceWorkspaceName: string,
        targetWorkspaceName: string,
        tabIds: string[]
    ): Promise<boolean> {
        try {
            Logger.debug(`Moving tabs from ${sourceWorkspaceName} to ${targetWorkspaceName}:`, tabIds);
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
                    Logger.warn(`Tab ${tabId} not found in workspace ${sourceWorkspaceName}`);
                }
            }
            Logger.debug('Tabs to move:', tabsToMove);
            // Add tabs to the target workspace
            for (const tab of tabsToMove) {
                this.addTabToWorkspace(targetWorkspace, tab);
            }
            
            // Remove all found tabs from the source workspace
            for (const tabId of tabsToMove.map(t => t.id)) {
                this.removeTabFromWorkspace(sourceWorkspace, tabId);
           }

            // Update timestamps
            sourceWorkspace.mtime = new Date().toISOString();
            targetWorkspace.mtime = new Date().toISOString();

            // Save changes
            await this.saveWorkspaces(workspacesData);

            // TODO: actually this is much more complex. See INFO and TODOs.md
            // Trigger workspace reload for both source and target
            //this.app.workspace.trigger('workspace-save', sourceWorkspaceName);
            //this.app.workspace.trigger('workspace-save', targetWorkspaceName);

            // Commit transaction
            await this.commitTransaction();

            return true;
        } catch (error) {
            // Rollback on error
            await this.rollbackTransaction();
            Logger.error('Failed to move files:', error);
            new Notice(`Failed to move files: ${(error as Error).message}`);
            return false;
        }
    }

    async copyTabsBetweenWorkspaces(
        sourceWorkspaceName: string,
        targetWorkspaceName: string,
        tabIds: string[]
    ): Promise<boolean> {
        try {
            Logger.debug(`Copying tabs from ${sourceWorkspaceName} to ${targetWorkspaceName}:`, tabIds);
            await this.beginTransaction();

            const workspacesData = await this.getWorkspaces();

            if (!workspacesData.workspaces[sourceWorkspaceName] ||
                !workspacesData.workspaces[targetWorkspaceName]) {
                throw new Error('Source or target workspace not found');
            }

            const sourceWorkspace = workspacesData.workspaces[sourceWorkspaceName];
            const targetWorkspace = workspacesData.workspaces[targetWorkspaceName];

            const tabsToCopy: LayoutComponent[] = [];

            for (const tabId of tabIds) {
                const tabInfo = this.findTabInWorkspace(sourceWorkspace, tabId);
                if (tabInfo) {
                    tabsToCopy.push(tabInfo.tab);
                } else {
                    Logger.warn(`Tab ${tabId} not found in workspace ${sourceWorkspaceName}`);
                }
            }
            Logger.debug('Tabs to copy:', tabsToCopy);

            for (const tab of tabsToCopy) {
                this.addTabToWorkspace(targetWorkspace, tab);
            }

            targetWorkspace.mtime = new Date().toISOString();

            await this.saveWorkspaces(workspacesData);

            await this.commitTransaction();

            return true;
        } catch (error) {
            await this.rollbackTransaction();
            Logger.error('Failed to copy tabs:', error);
            new Notice(`Failed to copy tabs: ${(error as Error).message}`);
            return false;
        }
    }

    async deleteTabsFromWorkspace(workspaceName: string, tabIds: string[]): Promise<boolean> {
        try {
            Logger.debug(`Deleting tabs from ${workspaceName}:`, tabIds);
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
                    Logger.warn(`Tab ${tabId} not found in workspace ${workspaceName}`);
                }
            }
            Logger.debug(`Deleted ${tabsDeleted} tabs`);
            if (tabsDeleted > 0) {
                workspace.mtime = new Date().toISOString();
                await this.saveWorkspaces(workspacesData);
                // Trigger workspace reload
                this.app.workspace.trigger('workspace-save', workspaceName);
            }

            await this.commitTransaction();
            return true;

        } catch (error) {
            await this.rollbackTransaction();
            Logger.error('Failed to delete tabs:', error);
            new Notice(`Failed to delete tabs: ${(error as Error).message}`);
            return false;
        }
    }

    // Transaction methods
    async beginTransaction(): Promise<void> {
        Logger.debug('Beginning transaction');
        // Create a backup before starting transaction
        this.transactionBackupPath = await this.createBackup();
    }

    async commitTransaction(): Promise<void> {
        Logger.debug('Committing transaction');
        // Clear the transaction backup
        this.transactionBackupPath = null;
    }

    async rollbackTransaction(): Promise<void> {
        if (!this.transactionBackupPath) {
            Logger.warn('No transaction backup to restore');
            return;
        }
        Logger.debug('Rolling back transaction');
        try {
            // Restore from backup
            const backupContent = await this.app.vault.adapter.read(this.transactionBackupPath);
            await this.app.vault.adapter.write('.obsidian/workspaces.json', backupContent);
            this.transactionBackupPath = null;
        } catch (error) {
            Logger.error('Failed to rollback transaction:', error);
            throw new Error(`Failed to rollback: ${(error as Error).message}`);
        }
    }

    // Utility methods
    private findTabInWorkspace(workspace: WorkspaceLayout, tabId: string): { tab: LayoutComponent, parent: LayoutComponent } | null {
        Logger.debug(`Finding tab ${tabId} in workspace:`, workspace);
        const find = (node: LayoutComponent): { tab: LayoutComponent, parent: LayoutComponent } | null => {
            if (node.children) {
                for (const child of node.children) {
                    if (child.id === tabId && child.type === 'leaf') {
                        Logger.debug(`Found tab ${tabId}:`, child);
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
        const result = find(workspace.main);
        if (!result) {
            Logger.debug(`Tab ${tabId} not found`);
        }
        return result;
    }

    private removeTabFromWorkspace(workspace: WorkspaceLayout, tabId: string): boolean {
        Logger.debug(`Removing tab ${tabId} from workspace:`, workspace);
        const tabInfo = this.findTabInWorkspace(workspace, tabId);
        if (tabInfo && tabInfo.parent && tabInfo.parent.children) {
            tabInfo.parent.children = tabInfo.parent.children.filter(child => child.id !== tabId);

            // If a split is now empty, remove it
            if (tabInfo.parent.children.length === 0 && tabInfo.parent.type === 'split') {
                // This is complex, for now we leave empty splits.
                // A more robust solution would be to recursively clean up empty parents.
                Logger.debug('An empty split was left after removing a tab');
            }
            Logger.debug(`Tab ${tabId} removed`);
            return true;
        }
        Logger.debug(`Tab ${tabId} could not be removed`);
        return false;
    }

    private addTabToWorkspace(workspace: WorkspaceLayout, tab: LayoutComponent): void {
        Logger.debug(`Adding tab to workspace:`, tab, workspace);
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
            Logger.debug('No tab group found, creating a new one');
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
        Logger.debug('Target tab group:', targetTabs);
        if (!targetTabs.children) {
            targetTabs.children = [];
        }
        targetTabs.children.push(tab);
        Logger.debug('Tab added to workspace');
    }

    private async writeAtomically(path: string, data: string): Promise<void> {
        const tempPath = `${path}.tmp`;
        Logger.debug(`Writing atomically to ${path} via ${tempPath}`);
        try {
            // Write to temporary file first
            await this.app.vault.adapter.write(tempPath, data);

            // Validate the written data
            const writtenData = await this.app.vault.adapter.read(tempPath);
            this.validateData(writtenData, data);

            // Create backup of original file if it exists
            if (await this.app.vault.adapter.exists(path)) {
                const backupPath = `${path}.bak`;
                Logger.debug(`Backing up original file to ${backupPath}`);
                const originalData = await this.app.vault.adapter.read(path);
                await this.app.vault.adapter.write(backupPath, originalData);
            }

            // Rename temp file to target file
            if (await this.app.vault.adapter.exists(path)) {
                await this.app.vault.adapter.remove(path);
            }
            await this.app.vault.adapter.rename(tempPath, path);
            Logger.debug(`Successfully wrote to ${path}`);
        } catch (error) {
            // Clean up temp file if it exists
            if (await this.app.vault.adapter.exists(tempPath)) {
                await this.app.vault.adapter.remove(tempPath);
            }

            throw error;
        }
    }

    private validateData(written: string, expected: string): void {
        Logger.debug('Validating written data');
        // Simple validation - check if the written data is valid JSON
        try {
            JSON.parse(written);
        } catch (error) {
            Logger.error('Data validation failed:', error);
            throw new Error(`Data validation failed: ${(error as Error).message}`);
        }
    }

    private async ensureFolder(path: string): Promise<void> {
        if (!(await this.app.vault.adapter.exists(path))) {
            Logger.debug(`Creating folder at ${path}`);
            await this.app.vault.adapter.mkdir(path);
        }
    }

    private async pruneOldBackups(): Promise<void> {
        const backupFolder = this.settings.backupLocation || '.obsidian/backups';
        const maxBackups = this.settings.maxBackups || 10;
        Logger.debug(`Pruning old backups in ${backupFolder}, max backups: ${maxBackups}`);
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
            Logger.debug('Found backup files:', backupFiles);
            // Remove oldest backups if we exceed the limit
            if (backupFiles.length > maxBackups) {
                const filesToRemove = backupFiles.slice(maxBackups);
                Logger.debug('Files to remove:', filesToRemove);
                for (const file of filesToRemove) {
                    await this.app.vault.adapter.remove(file);
                }
            }
        } catch (error) {
            Logger.warn('Failed to prune old backups:', error);
        }
    }
}