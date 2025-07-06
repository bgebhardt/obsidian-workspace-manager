import express, { Express, Request, Response } from 'express';
import { VaultManager } from './vaultManager';
import { ProcessManager } from './processManager';
import { WorkspaceManager as LocalWorkspaceManager } from './workspaceManager';
import { asyncHandler } from './utils';

const app: Express = express();
const port = 5005;
const vaultManager = new VaultManager();
const processManager = new ProcessManager();

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Offline Workspace Manager server is running!');
});

app.get('/api/vaults', asyncHandler(async (req: Request, res: Response) => {
  const vaults = await vaultManager.getVaults();
  res.json(vaults);
}));

app.get('/api/obsidian-status', asyncHandler(async (req: Request, res: Response) => {
  const status = await processManager.getObsidianStatus();
  res.json(status);
}));

app.get('/api/workspaces', asyncHandler(async (req: Request, res: Response) => {
  const vaultPath = req.query.vaultPath as string;
  if (!vaultPath) {
    res.status(400).json({ error: 'vaultPath query parameter is required' });
    return;
  }
  const workspaceManager = new LocalWorkspaceManager(vaultPath);
  const workspacesData = await workspaceManager.getWorkspaces();
  res.json(workspacesData);
}));

app.post('/api/workspaces/move', asyncHandler(async (req: Request, res: Response) => {
  const { vaultPath, sourceWorkspace, targetWorkspace, tabIds } = req.body;
  if (!vaultPath || !sourceWorkspace || !targetWorkspace || !tabIds) {
    res.status(400).json({ error: 'Missing required parameters.' });
    return;
  }
  const workspaceManager = new LocalWorkspaceManager(vaultPath);
  await workspaceManager.moveTabsBetweenWorkspaces(sourceWorkspace, targetWorkspace, tabIds);
  res.json({ success: true });
}));

app.post('/api/workspaces/copy', asyncHandler(async (req: Request, res: Response) => {
  const { vaultPath, sourceWorkspace, targetWorkspace, tabIds } = req.body;
  if (!vaultPath || !sourceWorkspace || !targetWorkspace || !tabIds) {
    res.status(400).json({ error: 'Missing required parameters.' });
    return;
  }
  const workspaceManager = new LocalWorkspaceManager(vaultPath);
  await workspaceManager.copyTabsBetweenWorkspaces(sourceWorkspace, targetWorkspace, tabIds);
  res.json({ success: true });
}));

app.post('/api/workspaces/delete', asyncHandler(async (req: Request, res: Response) => {
  const { vaultPath, workspaceName, tabIds } = req.body;
  if (!vaultPath || !workspaceName || !tabIds) {
    res.status(400).json({ error: 'Missing required parameters.' });
    return;
  }
  const workspaceManager = new LocalWorkspaceManager(vaultPath);
  await workspaceManager.deleteTabsFromWorkspace(workspaceName, tabIds);
  res.json({ success: true });
}));

app.post('/api/workspaces/delete-duplicates', asyncHandler(async (req: Request, res: Response) => {
  const { vaultPath, workspaceName } = req.body;
  if (!vaultPath || !workspaceName) {
    res.status(400).json({ error: 'Missing required parameters.' });
    return;
  }
  const workspaceManager = new LocalWorkspaceManager(vaultPath);
  await workspaceManager.deleteDuplicateTabsFromWorkspace(workspaceName);
  res.json({ success: true });
}));

app.post('/api/obsidian/quit', asyncHandler(async (req: Request, res: Response) => {
  await processManager.quitObsidian();
  res.json({ success: true });
}));

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});