import { App, Modal, Setting, ButtonComponent } from 'obsidian';
import { WorkspaceManager, WorkspaceData, TabData } from './workspace-manager';

export class WorkspaceManagerModal extends Modal {
    private workspaces: Record<string, WorkspaceData> = {};
    private selectedWorkspace: string = '';
    private selectedFiles: Set<string> = new Set();

    constructor(app: App, private workspaceManager: WorkspaceManager) {
        super(app);
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Workspace Manager' });

        // Load workspaces
        this.workspaces = await this.workspaceManager.getWorkspaces();

        this.createWorkspaceList(contentEl);
        this.createFileList(contentEl);
        this.createControls(contentEl);
    }

    createWorkspaceList(container: HTMLElement) {
        const workspaceContainer = container.createDiv('workspace-list');
        workspaceContainer.createEl('h3', { text: 'Workspaces' });

        Object.keys(this.workspaces).forEach(workspaceName => {
            const workspaceEl = workspaceContainer.createDiv('workspace-item');
            workspaceEl.setText(workspaceName);
            workspaceEl.addClass('clickable-item');
            
            workspaceEl.addEventListener('click', () => {
                // Remove previous selection
                workspaceContainer.querySelectorAll('.selected').forEach(el => 
                    el.removeClass('selected')
                );
                
                workspaceEl.addClass('selected');
                this.selectedWorkspace = workspaceName;
                this.updateFileList();
            });
        });
    }

    createFileList(container: HTMLElement) {
        const fileContainer = container.createDiv('file-list');
        fileContainer.createEl('h3', { text: 'Files in Workspace' });
        
        // This will be populated when a workspace is selected
        const fileListEl = fileContainer.createDiv('file-items');
        fileListEl.id = 'file-list-content';
    }

    updateFileList() {
        const fileListEl = document.getElementById('file-list-content');
        if (!fileListEl || !this.selectedWorkspace) return;

        fileListEl.empty();
        
        const workspace = this.workspaces[this.selectedWorkspace];
        const tabs = this.workspaceManager.extractTabsFromWorkspace(workspace);

        tabs.forEach(tab => {
            const fileEl = fileListEl.createDiv('file-item');
            
            const checkbox = fileEl.createEl('input', { type: 'checkbox' });
            checkbox.addEventListener('change', (e) => {
                if ((e.target as HTMLInputElement).checked) {
                    this.selectedFiles.add(tab.path);
                } else {
                    this.selectedFiles.delete(tab.path);
                }
            });

            fileEl.createSpan({ text: tab.title });
            fileEl.createSpan({ text: ` (${tab.path})`, cls: 'file-path' });
        });
    }

    createControls(container: HTMLElement) {
        const controlsContainer = container.createDiv('controls');

        // Target workspace dropdown
        new Setting(controlsContainer)
            .setName('Move to workspace')
            .addDropdown(dropdown => {
                Object.keys(this.workspaces).forEach(name => {
                    dropdown.addOption(name, name);
                });
            });

        // Action buttons
        const buttonContainer = controlsContainer.createDiv('button-container');
        
        new ButtonComponent(buttonContainer)
            .setButtonText('Move Selected Files')
            .onClick(async () => {
                await this.moveSelectedFiles();
            });

        new ButtonComponent(buttonContainer)
            .setButtonText('Close')
            .onClick(() => {
                this.close();
            });
    }

    async moveSelectedFiles() {
        // Implementation for moving files
        // Update the workspaces object and save
        await this.workspaceManager.saveWorkspaces(this.workspaces);
        this.updateFileList();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}