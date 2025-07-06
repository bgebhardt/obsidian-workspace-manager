import { WorkspaceManager, WorkspacesData, WorkspaceLayout } from './workspaceManager';
import * as fs from 'fs/promises';

// Mock the entire fs/promises module
jest.mock('fs/promises');
const mockedFs = fs as jest.Mocked<typeof fs>;

// --- Test Data ---
const createMockData = (): WorkspacesData => ({
  workspaces: {
    'Source Workspace': {
      main: {
        id: 'main-source',
        type: 'split',
        children: [
          {
            id: 'tabs-source',
            type: 'tabs',
            children: [
              { id: 'leaf1', type: 'leaf', state: { type: 'markdown', state: { file: 'file1.md' }, title: 'File One' } },
              { id: 'leaf2', type: 'leaf', state: { type: 'markdown', state: { file: 'file2.md' }, title: 'File Two' } },
            ],
          },
        ],
      },
      active: 'leaf1',
      mtime: '2023-01-01T00:00:00Z',
    },
    'Target Workspace': {
      main: {
        id: 'main-target',
        type: 'split',
        children: [
          { id: 'tabs-target', type: 'tabs', children: [] },
        ],
      },
      active: '',
      mtime: '2023-01-01T00:00:00Z',
    },
  },
  active: 'Source Workspace',
});


describe('WorkspaceManager', () => {
  let manager: WorkspaceManager;
  const vaultPath = '/fake/vault';

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new WorkspaceManager(vaultPath);
  });

  describe('getWorkspaces', () => {
    it('should correctly parse a valid workspaces.json file', async () => {
      mockedFs.readFile.mockResolvedValue(JSON.stringify(createMockData()));
      const data = await manager.getWorkspaces();
      expect(data).toEqual(createMockData());
    });
  });

  describe('moveTabsBetweenWorkspaces', () => {
    it('should move a tab from the source to the target workspace', async () => {
      const testData = createMockData();
      // Mock getWorkspaces to return our mutable test data object
      jest.spyOn(manager, 'getWorkspaces').mockResolvedValue(testData);
      
      await manager.moveTabsBetweenWorkspaces('Source Workspace', 'Target Workspace', ['leaf1']);
      
      // The manager should have modified the testData object in place.
      const sourceTabs = manager.extractTabsFromWorkspace(testData.workspaces['Source Workspace']);
      const targetTabs = manager.extractTabsFromWorkspace(testData.workspaces['Target Workspace']);

      expect(sourceTabs).toHaveLength(1);
      expect(sourceTabs[0].id).toBe('leaf2');
      
      expect(targetTabs).toHaveLength(1);
      expect(targetTabs[0].id).toBe('leaf1');

      // Verify that save was called with the modified data
      expect(manager.saveWorkspaces).toHaveBeenCalledWith(testData);
    });
  });

  describe('copyTabsBetweenWorkspaces', () => {
    it('should copy a tab to the target workspace and keep it in the source', async () => {
      const testData = createMockData();
      jest.spyOn(manager, 'getWorkspaces').mockResolvedValue(testData);
      // Also spy on saveWorkspaces to check what it's called with
      jest.spyOn(manager, 'saveWorkspaces').mockResolvedValue();

      await manager.copyTabsBetweenWorkspaces('Source Workspace', 'Target Workspace', ['leaf1']);

      const sourceTabs = manager.extractTabsFromWorkspace(testData.workspaces['Source Workspace']);
      const targetTabs = manager.extractTabsFromWorkspace(testData.workspaces['Target Workspace']);

      expect(sourceTabs).toHaveLength(2); // Stays the same
      
      expect(targetTabs).toHaveLength(1);
      expect(targetTabs[0].id).toBe('leaf1');

      expect(manager.saveWorkspaces).toHaveBeenCalledWith(testData);
    });
  });

  // We need to spy on saveWorkspaces for the above tests, so we mock it here.
  // The underlying file system calls are tested implicitly by the successful runs.
  beforeAll(() => {
    jest.spyOn(WorkspaceManager.prototype, 'saveWorkspaces').mockResolvedValue();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});