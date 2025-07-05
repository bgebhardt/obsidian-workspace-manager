import { WorkspaceManager } from '../src/WorkspaceManager';
import { App, Notice, TFile, Workspace, WorkspaceLeaf, FileView } from 'obsidian';
import { WorkspaceManagerSettings, DEFAULT_SETTINGS } from '../src/types';

// Mock Obsidian's API
jest.mock('obsidian', () => ({
    Notice: jest.fn(),
    App: jest.fn(),
    TFile: jest.fn(),
    Workspace: jest.fn(),
    WorkspaceLeaf: jest.fn(),
    FileView: jest.fn()
}), { virtual: true });

describe('WorkspaceManager', () => {
    let workspaceManager: WorkspaceManager;
    let mockApp: any;
    let mockSettings: WorkspaceManagerSettings;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Mock settings
        mockSettings = { ...DEFAULT_SETTINGS, debug: true };

        // Mock the core App object
        mockApp = {
            internalPlugins: {
                plugins: {
                    workspaces: {
                        enabled: true,
                        instance: {
                            workspaces: {
                                'Workspace 1': {
                                    main: {
                                        type: 'split',
                                        children: [
                                            {
                                                type: 'leaf',
                                                state: {
                                                    type: 'markdown',
                                                    state: {
                                                        file: 'file1.md'
                                                    }
                                                }
                                            },
                                            {
                                                type: 'leaf',
                                                state: {
                                                    type: 'markdown',
                                                    state: {
                                                        file: 'file2.md'
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                },
                                'Workspace 2': {}
                            },
                            saveWorkspaces: jest.fn().mockResolvedValue(undefined),
                            loadWorkspace: jest.fn().mockResolvedValue(undefined),
                            saveWorkspace: jest.fn().mockResolvedValue(undefined)
                        }
                    }
                }
            },
            workspace: {
                activeLeaf: {
                    getDisplayText: jest.fn().mockReturnValue('Current Workspace')
                },
                getLeavesOfType: jest.fn().mockReturnValue([]),
                iterateAllLeaves: jest.fn(),
                getLeaf: jest.fn().mockReturnValue({
                    openFile: jest.fn().mockResolvedValue(undefined)
                })
            },
            vault: {
                getAbstractFileByPath: jest.fn()
            }
        };

        workspaceManager = new WorkspaceManager(mockApp as App, mockSettings);
    });

    describe('isPluginEnabled', () => {
        it('should return true if the workspaces plugin is enabled', () => {
            expect(workspaceManager.isPluginEnabled()).toBe(true);
        });

        it('should return false and show a notice if the plugin is disabled', () => {
            mockApp.internalPlugins.plugins.workspaces.enabled = false;
            expect(workspaceManager.isPluginEnabled()).toBe(false);
            expect(Notice).toHaveBeenCalledWith('Workspaces plugin is not enabled');
        });
    });

    describe('getWorkspaceList', () => {
        it('should return a list of workspace names', () => {
            const list = workspaceManager.getWorkspaceList();
            expect(list).toEqual(['Workspace 1', 'Workspace 2']);
        });

        it('should return an empty list if the plugin is disabled', () => {
            mockApp.internalPlugins.plugins.workspaces.enabled = false;
            const list = workspaceManager.getWorkspaceList();
            expect(list).toEqual([]);
        });
    });

    describe('getFilesInWorkspace', () => {
        it('should extract the list of files from the workspace data', () => {
            const files = workspaceManager.getFilesInWorkspace('Workspace 1');
            expect(files).toEqual(['file1.md', 'file2.md']);
        });

        it('should return an empty array for a workspace that does not exist', () => {
            const files = workspaceManager.getFilesInWorkspace('Non-existent');
            expect(files).toEqual([]);
        });
    });

    describe('reorganizeWorkspace', () => {
        it('should load, modify, and save the workspace', async () => {
            const filesToAdd = ['new_file.md'];
            const filesToRemove = ['old_file.md'];

            // Mock the leaf iteration
            const mockLeaf = {
                view: { file: { path: 'old_file.md' } },
                detach: jest.fn()
            };
            mockApp.workspace.iterateAllLeaves.mockImplementation((callback: (leaf: any) => void) => {
                callback(mockLeaf);
            });

            // Mock file lookup
            mockApp.vault.getAbstractFileByPath.mockReturnValue(new TFile());

            await workspaceManager.reorganizeWorkspace('Workspace 1', filesToAdd, filesToRemove);

            expect(mockApp.internalPlugins.plugins.workspaces.instance.loadWorkspace).toHaveBeenCalledWith('Workspace 1');
            expect(mockLeaf.detach).toHaveBeenCalled();
            expect(mockApp.workspace.getLeaf).toHaveBeenCalledWith(true);
            expect(mockApp.internalPlugins.plugins.workspaces.instance.saveWorkspace).toHaveBeenCalledWith('Workspace 1');
            expect(Notice).toHaveBeenCalledWith('Workspace "Workspace 1" has been updated.');
        });
    });

    describe('deleteWorkspace', () => {
        it('should delete a workspace if it exists', async () => {
            await workspaceManager.deleteWorkspace('Workspace 1');
            expect(mockApp.internalPlugins.plugins.workspaces.instance.saveWorkspaces).toHaveBeenCalled();
            expect(Notice).toHaveBeenCalledWith('Workspace "Workspace 1" deleted.');
        });

        it('should show a notice if the workspace does not exist', async () => {
            await workspaceManager.deleteWorkspace('Non-existent');
            expect(Notice).toHaveBeenCalledWith('Workspace "Non-existent" not found.');
        });
    });

    describe('renameWorkspace', () => {
        it('should load, save with a new name, and delete the old workspace', async () => {
            await workspaceManager.renameWorkspace('Workspace 1', 'New Name');

            expect(mockApp.internalPlugins.plugins.workspaces.instance.loadWorkspace).toHaveBeenCalledWith('Workspace 1');
            expect(mockApp.internalPlugins.plugins.workspaces.instance.saveWorkspace).toHaveBeenCalledWith('New Name');
            expect(mockApp.internalPlugins.plugins.workspaces.instance.saveWorkspaces).toHaveBeenCalled();
            expect(Notice).toHaveBeenCalledWith('Workspace renamed from "Workspace 1" to "New Name".');
        });
    });
});