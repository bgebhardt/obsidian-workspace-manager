import { App, Modal, Setting, Notice } from 'obsidian';
import { WorkspaceManager } from './WorkspaceManager';
import { TabInfo } from './types';

export class WorkspaceManagerModal extends Modal {
    private sourceWorkspace: string = '';
    private targetWorkspace: string = '';
    private selectedTabs: string[] = [];
    private workspaceManager: WorkspaceManager;

    constructor(app: App, workspaceManager: WorkspaceManager) {
        super(app);
        this.workspaceManager = workspaceManager;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('workspace-manager-modal');

        contentEl.createEl('h2', { text: 'Workspace Manager' });

        const workspacesData = await this.workspaceManager.getWorkspaces();
        const workspaceNames = Object.keys(workspacesData.workspaces);

        if (workspaceNames.length < 1) {
            contentEl.createEl('p', { text: 'No workspaces found to manage.' });
            return;
        }

        // Set default workspaces
        this.sourceWorkspace = workspacesData.active || workspaceNames[0];
        this.targetWorkspace = workspaceNames.find(name => name !== this.sourceWorkspace) || this.sourceWorkspace;

        // Source workspace selector
        new Setting(contentEl)
            .setName('Source Workspace')
            .setDesc('Select the workspace to move files from')
            .addDropdown(dropdown => {
                workspaceNames.forEach(name => dropdown.addOption(name, name));
                dropdown.setValue(this.sourceWorkspace);
                dropdown.onChange(value => {
                    this.sourceWorkspace = value;
                    this.updateTabsList();
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
                });
            });

        // Container for tabs list
        contentEl.createDiv({ cls: 'workspace-manager-tabs' });

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'workspace-manager-buttons' });

        buttonContainer.createEl('button', { text: 'Move Selected', cls: 'mod-cta' })
            .addEventListener('click', async () => {
                if (this.sourceWorkspace === this.targetWorkspace) {
                    new Notice('Source and target workspaces must be different.');
                    return;
                }
                if (this.selectedTabs.length === 0) {
                    new Notice('No tabs selected to move.');
                    return;
                }
                const success = await this.workspaceManager.moveTabsBetweenWorkspaces(
                    this.sourceWorkspace,
                    this.targetWorkspace,
                    this.selectedTabs
                );
                if (success) {
                    new Notice(`Moved ${this.selectedTabs.length} tabs to ${this.targetWorkspace}.`);
                    this.close();
                }
            });

        buttonContainer.createEl('button', { text: 'Delete Selected' })
            .addEventListener('click', async () => {
                if (this.selectedTabs.length === 0) {
                    new Notice('No tabs selected to delete.');
                    return;
                }
                // In a later phase, we'll add a confirmation dialog
                const success = await this.workspaceManager.deleteTabsFromWorkspace(
                    this.sourceWorkspace,
                    this.selectedTabs
                );
                if (success) {
                    new Notice(`Deleted ${this.selectedTabs.length} tabs from ${this.sourceWorkspace}.`);
                    this.updateTabsList();
                }
            });

        // Initial tabs list
        this.updateTabsList();
    }

    async updateTabsList() {
        const tabsContainer = this.contentEl.querySelector('.workspace-manager-tabs');
        if (!tabsContainer) return;

        tabsContainer.empty();
        this.selectedTabs = [];

        const workspacesData = await this.workspaceManager.getWorkspaces();
        const workspace = workspacesData.workspaces[this.sourceWorkspace];

        if (!workspace) {
            tabsContainer.createEl('p', { text: 'Workspace not found.' });
            return;
        }

        const tabs = this.workspaceManager.extractTabsFromWorkspace(workspace);

        if (tabs.length === 0) {
            tabsContainer.createEl('p', { text: 'No open tabs in this workspace.' });
            return;
        }

        tabs.forEach((tab: TabInfo) => {
            new Setting(tabsContainer as HTMLElement)
                .setName(tab.title)
                .setDesc(tab.filePath)
                .addToggle(toggle => {
                    toggle.onChange(value => {
                        if (value) {
                            this.selectedTabs.push(tab.id);
                        } else {
                            this.selectedTabs = this.selectedTabs.filter(id => id !== tab.id);
                        }
                    });
                });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}