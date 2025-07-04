import { Plugin } from 'obsidian';
import { WorkspaceManager } from './WorkspaceManager';
import { WorkspaceManagerModal } from './WorkspaceManagerModal';

export default class WorkspaceManagerPlugin extends Plugin {
    workspaceManager!: WorkspaceManager;

    async onload() {
        console.log('Loading Workspace Manager plugin');

        this.workspaceManager = new WorkspaceManager(this.app, this);

        // Add ribbon icon
        this.addRibbonIcon('folder', 'Workspace Manager', () => {
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
        console.log('Unloading Workspace Manager plugin');
    }
}