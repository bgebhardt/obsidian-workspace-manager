import { WorkspaceManager } from '../src/WorkspaceManager';

jest.mock('obsidian', () => ({
    Notice: jest.fn(),
    Plugin: jest.fn(),
    App: jest.fn()
}), { virtual: true });

describe('WorkspaceManager', () => {
    let workspaceManager: WorkspaceManager;
    let mockApp: any;
    let mockPlugin: any;

    beforeEach(() => {
        // Setup mock app and plugin
        mockApp = {
            vault: {
                adapter: {
                    read: jest.fn(),
                    write: jest.fn(),
                    exists: jest.fn(),
                    remove: jest.fn(),
                    rename: jest.fn(),
                    mkdir: jest.fn(),
                    list: jest.fn()
                }
            }
        };

        mockPlugin = {
            settings: {
                backupLocation: '.obsidian/backups',
                maxBackups: 10
            }
        };

        workspaceManager = new WorkspaceManager(mockApp as any, mockPlugin as any);
    });

    describe('getWorkspaces', () => {
        it('should parse workspaces.json correctly', async () => {
            // Mock the read function to return a sample workspaces.json
            mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify({
                workspaces: {
                    Test1: { main: { id: '1', type: 'split', children: [] } },
                    Test2: { main: { id: '2', type: 'split', children: [] } }
                },
                active: 'Test1'
            }));

            const result = await workspaceManager.getWorkspaces();

            expect(result).toHaveProperty('workspaces');
            expect(result.workspaces).toHaveProperty('Test1');
            expect(result.workspaces).toHaveProperty('Test2');
            expect(result.active).toBe('Test1');
        });

        it('should handle errors when reading workspaces.json', async () => {
            // Mock the read function to throw an error
            mockApp.vault.adapter.read.mockRejectedValue(new Error('File not found'));

            const result = await workspaceManager.getWorkspaces();

            expect(result).toHaveProperty('workspaces');
            expect(Object.keys(result.workspaces)).toHaveLength(0);
            expect(result.active).toBe('');
        });
    });

    describe('extractTabsFromWorkspace', () => {
        it('should extract tabs from a workspace', () => {
            const workspace = {
                main: {
                    id: 'main',
                    type: 'split',
                    children: [
                        {
                            id: 'tabs1',
                            type: 'tabs',
                            children: [
                                {
                                    id: 'leaf1',
                                    type: 'leaf',
                                    state: {
                                        type: 'markdown',
                                        state: {
                                            file: 'test.md',
                                            mode: 'source'
                                        },
                                        title: 'Test'
                                    }
                                }
                            ]
                        }
                    ]
                },
                active: 'leaf1',
                mtime: '2023-01-01T00:00:00Z'
            };

            const tabs = workspaceManager.extractTabsFromWorkspace(workspace as any);

            expect(tabs).toHaveLength(1);
            expect(tabs[0].id).toBe('leaf1');
            expect(tabs[0].filePath).toBe('test.md');
            expect(tabs[0].title).toBe('Test');
            expect(tabs[0].type).toBe('markdown');
        });
    });

    describe('moveTabsBetweenWorkspaces', () => {
        let mockWorkspacesData: any;

        beforeEach(() => {
            mockWorkspacesData = {
                workspaces: {
                    'Source': {
                        main: {
                            id: 'main-source', type: 'split', children: [
                                {
                                    id: 'tabs-source', type: 'tabs', children: [
                                        { id: 'leaf1', type: 'leaf', state: { state: { file: 'file1.md' } } }
                                    ]
                                }
                            ]
                        }
                    },
                    'Target': {
                        main: {
                            id: 'main-target', type: 'split', children: [
                                {
                                    id: 'tabs-target', type: 'tabs', children: [
                                        { id: 'leaf2', type: 'leaf', state: { state: { file: 'file2.md' } } }
                                    ]
                                }
                            ]
                        }
                    }
                },
                active: 'Source'
            };
            mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(mockWorkspacesData));
            mockApp.vault.adapter.exists.mockResolvedValue(true);
            mockApp.vault.adapter.list.mockResolvedValue({ files: [] });
        });

        it('should move tabs from source to target workspace', async () => {
            const success = await workspaceManager.moveTabsBetweenWorkspaces('Source', 'Target', ['leaf1']);

            expect(success).toBe(true);
            expect(mockApp.vault.adapter.write).toHaveBeenCalled();

            const writtenData = JSON.parse(mockApp.vault.adapter.write.mock.calls[0][1]);
            const sourceWorkspace = writtenData.workspaces['Source'];
            const targetWorkspace = writtenData.workspaces['Target'];

            expect(sourceWorkspace.main.children[0].children).toHaveLength(0);
            expect(targetWorkspace.main.children[0].children).toHaveLength(2);
            expect(targetWorkspace.main.children[0].children.find((t: any) => t.id === 'leaf1')).toBeDefined();
        });

        it('should return false and rollback on error', async () => {
            mockApp.vault.adapter.write.mockRejectedValue(new Error('Write failed'));

            const success = await workspaceManager.moveTabsBetweenWorkspaces('Source', 'Target', ['leaf1']);

            expect(success).toBe(false);
            // Check if rollback was called, which reads the backup
            expect(mockApp.vault.adapter.read).toHaveBeenCalledWith('.obsidian/backups/workspaces-backup-some-timestamp.json');
        });
    });

    describe('deleteTabsFromWorkspace', () => {
        let mockWorkspacesData: any;

        beforeEach(() => {
            mockWorkspacesData = {
                workspaces: {
                    'MyWorkspace': {
                        main: {
                            id: 'main', type: 'split', children: [
                                {
                                    id: 'tabs', type: 'tabs', children: [
                                        { id: 'leaf1', type: 'leaf', state: { state: { file: 'file1.md' } } },
                                        { id: 'leaf2', type: 'leaf', state: { state: { file: 'file2.md' } } }
                                    ]
                                }
                            ]
                        }
                    }
                },
                active: 'MyWorkspace'
            };
            mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(mockWorkspacesData));
            mockApp.vault.adapter.exists.mockResolvedValue(true);
            mockApp.vault.adapter.list.mockResolvedValue({ files: [] });
        });

        it('should delete tabs from a workspace', async () => {
            const success = await workspaceManager.deleteTabsFromWorkspace('MyWorkspace', ['leaf1']);

            expect(success).toBe(true);
            expect(mockApp.vault.adapter.write).toHaveBeenCalled();

            const writtenData = JSON.parse(mockApp.vault.adapter.write.mock.calls[0][1]);
            const workspace = writtenData.workspaces['MyWorkspace'];

            expect(workspace.main.children[0].children).toHaveLength(1);
            expect(workspace.main.children[0].children.find((t: any) => t.id === 'leaf1')).toBeUndefined();
        });
    });
});