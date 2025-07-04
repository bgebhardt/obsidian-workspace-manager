import { WorkspaceManager } from '../src/WorkspaceManager';

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
});