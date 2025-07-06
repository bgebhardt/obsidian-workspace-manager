import { App, Notice, TFile, FileView, WorkspaceLeaf } from 'obsidian';
import { WorkspaceManagerSettings } from './types';
import { Logger } from './Logger';

export class WorkspaceManager {
    constructor(private app: App, private settings: WorkspaceManagerSettings) {}

    private get workspacePlugin() {
        return (this.app as any).internalPlugins.plugins.workspaces;
    }

    /**
     * Checks if the Workspaces plugin is enabled.
     * @returns {boolean} - True if the plugin is enabled, false otherwise.
     */
    isPluginEnabled(): boolean {
        const enabled = this.workspacePlugin?.enabled;
        if (!enabled) {
            new Notice('Workspaces plugin is not enabled');
            Logger.warn('Workspaces plugin is not enabled');
        }
        return enabled;
    }

    /**
     * Gets the list of all available workspaces.
     * @returns {string[]} - A list of workspace names.
     */
    getWorkspaceList(): string[] {
        if (!this.isPluginEnabled()) return [];
        
        const workspaces = this.workspacePlugin.instance?.workspaces || {};
        Logger.debug('Available workspaces:', Object.keys(workspaces));
        return Object.keys(workspaces);
    }

    /**
     * Gets the list of open file paths in a given workspace.
     * @param {string} workspaceName - The name of the workspace to inspect.
     * @returns {Promise<string[]>} - A list of file paths.
     */
    getFilesInWorkspace(workspaceName: string): string[] {
        if (!this.isPluginEnabled()) return [];

        const workspace = this.workspacePlugin.instance?.workspaces[workspaceName];
        if (!workspace) {
            Logger.warn(`Workspace "${workspaceName}" not found.`);
            return [];
        }

        const files: string[] = [];
        const extractFromNode = (node: any) => {
            if (node?.type === 'leaf' && node.state?.state?.file) {
                if (typeof node.state.state.file === 'string') {
                    files.push(node.state.state.file);
                }
            } else if (node?.children && Array.isArray(node.children)) {
                node.children.forEach(extractFromNode);
            }
        };

        if (workspace.main) {
            extractFromNode(workspace.main);
        }
        
        Logger.debug(`Files in workspace "${workspaceName}":`, files);
        return files;
    }

    /**
     * Reorganizes a workspace by adding and removing files.
     * @param {string} workspaceName - The name of the workspace to reorganize.
     * @param {string[]} filesToAdd - A list of file paths to add to the workspace.
     * @param {string[]} filesToRemove - A list of file paths to remove from the workspace.
     */
    async reorganizeWorkspace(workspaceName: string, filesToAdd: string[], filesToRemove: string[]): Promise<void> {
        if (!this.isPluginEnabled()) {
            Logger.warn('reorganizeWorkspace: Workspaces plugin is not enabled. Aborting.');
            return;
        }

        Logger.debug(`Starting reorganization for workspace: "${workspaceName}"`, { filesToAdd, filesToRemove });

        Logger.debug(`Loading workspace "${workspaceName}"...`);
        await this.workspacePlugin.instance.loadWorkspace(workspaceName);
        Logger.debug(`Workspace "${workspaceName}" loaded.`);

        // Remove unwanted files
        if (filesToRemove.length > 0) {
            Logger.debug('Removing files:', filesToRemove);
            this.app.workspace.iterateAllLeaves((leaf) => {
                const filePath = (leaf.view as FileView).file?.path;
                if (filePath && filesToRemove.includes(filePath)) {
                    Logger.debug(`Detaching leaf with file: "${filePath}"`);
                    leaf.detach();
                }
            });
            Logger.debug('Finished removing files.');
        }
        
        // Add new files
        if (filesToAdd.length > 0) {
            Logger.debug('Adding files:', filesToAdd);
            for (const filePath of filesToAdd) {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    Logger.debug(`Found file in vault: "${filePath}". Opening in new leaf.`);
                    const leaf = this.app.workspace.getLeaf(true);
                    await leaf.openFile(file);
                    Logger.debug(`File "${filePath}" opened.`);
                } else {
                    Logger.warn(`File not found in vault: "${filePath}". Skipping.`);
                }
            }
            Logger.debug('Finished adding files.');
        }

        Logger.debug(`Saving workspace "${workspaceName}"...`);
        await this.workspacePlugin.instance.saveWorkspace(workspaceName);
        Logger.debug(`Workspace "${workspaceName}" saved.`);

        new Notice(`Workspace "${workspaceName}" has been updated.`);
        Logger.info(`Workspace "${workspaceName}" reorganized and saved.`);
    }
/**
     * Adds a tab to a workspace.
     * @param {string} workspaceName - The name of the workspace.
     * @param {string} filePath - The file path of the tab to add.
     */
    async addTabToWorkspace(workspaceName: string, filePath: string): Promise<void> {
        if (!this.isPluginEnabled()) {
            return;
        }

        Logger.debug(`Adding tab "${filePath}" to workspace: "${workspaceName}"`);

        await this.workspacePlugin.instance.loadWorkspace(workspaceName);

        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            Logger.debug(`Found file in vault: "${filePath}". Opening in new leaf.`);
            
            const leaf = this.app.workspace.getLeaf(true); // new tab
            await leaf.openFile(file); // open file in that tab
            
            Logger.debug(`File "${filePath}" opened.`);
        } else {
            Logger.warn(`File not found in vault: "${filePath}". Skipping.`);
            new Notice(`File not found: ${filePath}`);
            return;
        }

        //await this.workspacePlugin.instance.saveWorkspace(workspaceName);
        new Notice(`Tab "${filePath}" added to workspace "${workspaceName}".`);
        Logger.info(`Tab "${filePath}" added to workspace "${workspaceName}".`);
    }

    /**
     * Deletes a tab from a workspace.
     * @param {string} workspaceName - The name of the workspace.
     * @param {string} filePath - The file path of the tab to delete.
     */
    async deleteTabFromWorkspace(workspaceName: string, filePath: string): Promise<void> {
        if (!this.isPluginEnabled()) {
            return;
        }

        Logger.debug(`Deleting tab "${filePath}" from workspace: "${workspaceName}"`);

        await this.workspacePlugin.instance.loadWorkspace(workspaceName);

        let leafFound = false;
        this.app.workspace.iterateAllLeaves((leaf) => {
            const leafFilePath = (leaf.view as FileView).file?.path;
            if (leafFilePath && leafFilePath === filePath) {
                Logger.debug(`Detaching leaf with file: "${leafFilePath}"`);
                leaf.detach();
                leafFound = true;
            }
        });

        if (!leafFound) {
            new Notice(`Tab "${filePath}" not found in the current layout of workspace "${workspaceName}".`);
            Logger.warn(`Tab "${filePath}" not found in workspace "${workspaceName}" for deletion.`);
        }
        
        await this.workspacePlugin.instance.saveWorkspace(workspaceName);

        if (leafFound) {
            new Notice(`Tab "${filePath}" removed from workspace "${workspaceName}".`);
            Logger.info(`Tab "${filePath}" removed from workspace "${workspaceName}".`);
        }
    }

    /**
     * Deletes a workspace.
     * @param {string} workspaceName - The name of the workspace to delete.
     */
    async deleteWorkspace(workspaceName: string): Promise<void> {
        if (!this.isPluginEnabled()) return;

        const workspaceInstance = this.workspacePlugin.instance;
        if (workspaceInstance && workspaceInstance.workspaces[workspaceName]) {
            delete workspaceInstance.workspaces[workspaceName];
            await workspaceInstance.saveWorkspaces();
            new Notice(`Workspace "${workspaceName}" deleted.`);
            Logger.info(`Workspace "${workspaceName}" deleted.`);
        } else {
            new Notice(`Workspace "${workspaceName}" not found.`);
            Logger.warn(`Workspace "${workspaceName}" not found for deletion.`);
        }
    }

    /**
     * Renames a workspace.
     * @param {string} oldName - The current name of the workspace.
     * @param {string} newName - The new name for the workspace.
     */
    async renameWorkspace(oldName: string, newName: string): Promise<void> {
        if (!this.isPluginEnabled()) return;

        Logger.debug(`Renaming workspace from "${oldName}" to "${newName}".`);

        await this.workspacePlugin.instance.loadWorkspace(oldName);
        await this.workspacePlugin.instance.saveWorkspace(newName);
        await this.deleteWorkspace(oldName);

        new Notice(`Workspace renamed from "${oldName}" to "${newName}".`);
        Logger.info(`Workspace renamed from "${oldName}" to "${newName}".`);
    }

}