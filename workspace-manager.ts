import { App, Plugin, Notice } from 'obsidian';

export interface WorkspaceData {
    name: string;
    tabs: TabData[];
    layout: any;
}

export interface TabData {
    id: string;
    path: string;
    title: string;
    type: string;
}

export class WorkspaceManager {
    constructor(private app: App, private plugin: Plugin) {}

    async getWorkspaces(): Promise<Record<string, WorkspaceData>> {
        try {
            const workspaceFile = await this.app.vault.adapter.read('.obsidian/workspaces.json');
            return JSON.parse(workspaceFile);
        } catch (error) {
            new Notice('Could not read workspaces file');
            return {};
        }
    }

    async saveWorkspaces(workspaces: Record<string, WorkspaceData>): Promise<void> {
        try {
            // Create backup first
            await this.createBackup();
            
            const jsonString = JSON.stringify(workspaces, null, 2);
            await this.app.vault.adapter.write('.obsidian/workspaces.json', jsonString);
            
            new Notice('Workspaces updated successfully');
        } catch (error) {
            new Notice('Failed to save workspaces');
            console.error(error);
        }
    }

    async createBackup(): Promise<void> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `.obsidian/workspaces-backup-${timestamp}.json`;
        
        try {
            const currentWorkspaces = await this.app.vault.adapter.read('.obsidian/workspaces.json');
            await this.app.vault.adapter.write(backupName, currentWorkspaces);
        } catch (error) {
            console.warn('Could not create backup:', error);
        }
    }

    extractTabsFromWorkspace(workspace: any): TabData[] {
        const tabs: TabData[] = [];
        
        // Recursively extract tabs from Obsidian's layout structure
        const extractFromNode = (node: any) => {
            if (node.type === 'leaf' && node.state?.file) {
                tabs.push({
                    id: node.id || '',
                    path: node.state.file,
                    title: node.state.file.split('/').pop() || '',
                    type: node.state.type || 'markdown'
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

    moveFilesBetweenWorkspaces(
        workspaces: Record<string, WorkspaceData>,
        filePaths: string[],
        fromWorkspace: string,
        toWorkspace: string
    ): Record<string, WorkspaceData> {
        // Implementation for moving files between workspaces
        // This requires manipulating the layout structure
        return workspaces;
    }
}