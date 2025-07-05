import { App, Modal, Setting, Notice } from 'obsidian';
import { WorkspaceManager } from './WorkspaceManager';
import { Logger } from './Logger';

export class WorkspaceManagerModal extends Modal {
    private sourceWorkspace: string = '';
    private targetWorkspace: string = '';
    private selectedFiles: string[] = [];
    private filesInSource: string[] = [];

    constructor(app: App, private workspaceManager: WorkspaceManager) {
        super(app);
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('workspace-manager-modal');

        contentEl.createEl('h2', { text: 'Workspace Manager' });

        if (!this.workspaceManager.isPluginEnabled()) {
            contentEl.createEl('p', { text: 'The Workspaces plugin is not enabled. Please enable it in the Obsidian settings.' });
            return;
        }

        const workspaceNames = this.workspaceManager.getWorkspaceList();
        Logger.info('Workspaces found:', workspaceNames);

        if (workspaceNames.length < 1) {
            contentEl.createEl('p', { text: 'No workspaces found to manage.' });
            return;
        }

        // Set default workspaces
        this.sourceWorkspace = this.app.workspace.activeLeaf?.getDisplayText() || workspaceNames[0];
        this.targetWorkspace = workspaceNames.find(name => name !== this.sourceWorkspace) || this.sourceWorkspace;

        // Source workspace selector
        new Setting(contentEl)
            .setName('Source Workspace')
            .setDesc('Select the workspace to move files from')
            .addDropdown(dropdown => {
                workspaceNames.forEach(name => dropdown.addOption(name, name));
                dropdown.setValue(this.sourceWorkspace);
                dropdown.onChange(async (value) => {
                    this.sourceWorkspace = value;
                    Logger.debug(`Source workspace changed to: ${value}`);
                    await this.updateTabsList();
                });
            });

        // Target workspace selector
        new Setting(contentEl)
            .setName('Target Workspace')
            .setDesc('Select the workspace to move files to')
            .addDropdown(dropdown => {
                workspaceNames.forEach(name => dropdown.addOption(name, name));
                dropdown.setValue(this.targetWorkspace);
                dropdown.onChange(value => {
                    this.targetWorkspace = value;
                    Logger.debug(`Target workspace changed to: ${value}`);
                });
            });

        // Container for tabs list
        contentEl.createDiv({ cls: 'workspace-manager-tabs' });

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'workspace-manager-buttons' });

        buttonContainer.createEl('button', { text: 'Move Selected', cls: 'mod-cta' })
            .addEventListener('click', async () => {
                Logger.debug('Move button clicked');
                if (this.sourceWorkspace === this.targetWorkspace) {
                    new Notice('Source and target workspaces must be different.');
                    Logger.warn('Move failed: Source and target workspaces are the same.');
                    return;
                }
                if (this.selectedFiles.length === 0) {
                    new Notice('No files selected to move.');
                    Logger.warn('Move failed: No files selected.');
                    return;
                }
                
                Logger.debug(`Moving ${this.selectedFiles.length} files from ${this.sourceWorkspace} to ${this.targetWorkspace}`);
                // Move files by removing from source and adding to target
                await this.workspaceManager.reorganizeWorkspace(this.sourceWorkspace, [], this.selectedFiles);
                await this.workspaceManager.reorganizeWorkspace(this.targetWorkspace, this.selectedFiles, []);

                new Notice(`Moved ${this.selectedFiles.length} files to ${this.targetWorkspace}.`);
                await this.updateTabsList();
            });

        buttonContainer.createEl('button', { text: 'Copy Selected' })
            .addEventListener('click', async () => {
                Logger.debug('Copy button clicked');
                if (this.sourceWorkspace === this.targetWorkspace) {
                    new Notice('Source and target workspaces must be different.');
                    Logger.warn('Copy failed: Source and target workspaces are the same.');
                    return;
                }
                if (this.selectedFiles.length === 0) {
                    new Notice('No files selected to copy.');
                    Logger.warn('Copy failed: No files selected.');
                    return;
                }

                Logger.debug(`Copying ${this.selectedFiles.length} files from ${this.sourceWorkspace} to ${this.targetWorkspace}`);
                // Copy files by adding to target
                await this.workspaceManager.reorganizeWorkspace(this.targetWorkspace, this.selectedFiles, []);

                new Notice(`Copied ${this.selectedFiles.length} files to ${this.targetWorkspace}.`);
                await this.updateTabsList();
            });

        buttonContainer.createEl('button', { text: 'Delete Selected' })
            .addEventListener('click', async () => {
                Logger.debug('Delete button clicked');
                if (this.selectedFiles.length === 0) {
                    new Notice('No files selected to delete.');
                    Logger.warn('Delete failed: No files selected.');
                    return;
                }
                
                Logger.debug(`Deleting ${this.selectedFiles.length} files from ${this.sourceWorkspace}`);
                // Delete files from source
                await this.workspaceManager.reorganizeWorkspace(this.sourceWorkspace, [], this.selectedFiles);

                new Notice(`Deleted ${this.selectedFiles.length} files from ${this.sourceWorkspace}.`);
                await this.updateTabsList();
            });

        // Initial tabs list
        await this.updateTabsList();
    }

    async updateTabsList() {
        Logger.debug(`Updating tabs list for workspace: ${this.sourceWorkspace}`);
        const tabsContainer = this.contentEl.querySelector('.workspace-manager-tabs');
        if (!tabsContainer) {
            Logger.warn('Tabs container not found in modal.');
            return;
        }

        tabsContainer.empty();
        this.selectedFiles = [];

        this.filesInSource = await this.workspaceManager.getFilesInWorkspace(this.sourceWorkspace);
        Logger.debug('Files in source workspace:', this.filesInSource);

        if (this.filesInSource.length === 0) {
            tabsContainer.createEl('p', { text: 'No open files in this workspace.' });
            return;
        }

        this.filesInSource.forEach((filePath: string) => {
            new Setting(tabsContainer as HTMLElement)
                .setName(filePath.split('/').pop() || filePath)
                .setDesc(filePath)
                .addToggle(toggle => {
                    toggle.onChange(value => {
                        if (value) {
                            this.selectedFiles.push(filePath);
                        } else {
                            this.selectedFiles = this.selectedFiles.filter(path => path !== filePath);
                        }
                        Logger.debug('Selected files:', this.selectedFiles);
                    });
                });
        });
    }

    onClose() {
        Logger.debug('Closing Workspace Manager modal');
        const { contentEl } = this;
        contentEl.empty();
    }
}