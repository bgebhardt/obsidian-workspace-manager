import { Plugin } from 'obsidian';
import { WorkspaceManager } from './WorkspaceManager';

export default class WorkspaceManagerPlugin extends Plugin {
    workspaceManager!: WorkspaceManager;

    async onload() {
        console.log('Loading Workspace Manager plugin');

        this.workspaceManager = new WorkspaceManager(this.app, this);

        // Add ribbon icon
        this.addRibbonIcon('folder', 'Workspace Manager', () => {
            // In Phase 2, this will open the WorkspaceManagerModal
            console.log('Workspace Manager icon clicked');
        });

        // Add command
        this.addCommand({
            id: 'open-workspace-manager',
            name: 'Open Workspace Manager',
            callback: () => {
                // In Phase 2, this will open the WorkspaceManagerModal
                console.log('Workspace Manager command executed');
            }
        });
    }

    onunload() {
        console.log('Unloading Workspace Manager plugin');
    }
}