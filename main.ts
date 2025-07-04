import { Plugin, Modal, Notice, TFile } from 'obsidian';
import { WorkspaceManagerModal } from './workspace-modal';
import { WorkspaceManager } from './workspace-manager';

export default class WorkspaceReorgPlugin extends Plugin {
    workspaceManager: WorkspaceManager;

    async onload() {
        console.log('Loading Workspace Reorganizer');
        
        this.workspaceManager = new WorkspaceManager(this.app, this);

        // Add ribbon icon
        this.addRibbonIcon('layout-grid', 'Reorganize Workspaces', () => {
            new WorkspaceManagerModal(this.app, this.workspaceManager).open();
        });

        // Add command
        this.addCommand({
            id: 'open-workspace-manager',
            name: 'Open Workspace Manager',
            callback: () => {
                new WorkspaceManagerModal(this.app, this.workspaceManager).open();
            }
        });
    }

    onunload() {
        console.log('Unloading Workspace Reorganizer');
    }
}