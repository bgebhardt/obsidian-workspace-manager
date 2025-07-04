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

    // Utility methods
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