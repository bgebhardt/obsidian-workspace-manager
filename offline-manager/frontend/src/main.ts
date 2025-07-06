import './style.css';

// --- Type Definitions ---
// These should match the backend models
interface ObsidianVault {
  path: string;
  ts: number;
  name?: string;
}

// --- DOM Element References ---
const obsidianStatusEl = document.querySelector<HTMLDivElement>('#obsidian-status')!;
const vaultSelectorEl = document.querySelector<HTMLSelectElement>('#vault-selector')!;
const sourceWorkspaceListEl = document.querySelector<HTMLDivElement>('#source-workspace-list')!;
const targetWorkspaceListEl = document.querySelector<HTMLDivElement>('#target-workspace-list')!;
const tabListEl = document.querySelector<HTMLTableSectionElement>('#tab-list')!;
const copyButtonEl = document.querySelector<HTMLButtonElement>('#copy-button')!;
const moveButtonEl = document.querySelector<HTMLButtonElement>('#move-button')!;

// --- Type Definitions ---
interface WorkspaceLayout {
  main: LayoutComponent;
  // other properties are not needed for tab extraction on frontend
}

interface LayoutComponent {
  id: string;
  type: "split" | "tabs" | "leaf";
  children?: LayoutComponent[];
  state?: LeafState;
}

interface LeafState {
  type: string;
  state: {
    file?: string;
  };
  title?: string;
}

interface TabInfo {
  id: string;
  filePath: string;
  title: string;
}

interface WorkspacesData {
  workspaces: Record<string, WorkspaceLayout>;
  active: string;
}

// --- State ---
let currentWorkspaces: WorkspacesData | null = null;

// --- API Functions ---
async function getObsidianStatus() {
  try {
    const response = await fetch('/api/obsidian-status');
    const data = await response.json();
    updateObsidianStatus(data.isRunning);
  } catch (error) {
    console.error('Failed to fetch Obsidian status:', error);
    updateObsidianStatus(null);
  }
}

async function getVaults() {
  try {
    const response = await fetch('/api/vaults');
    const vaults: ObsidianVault[] = await response.json();
    populateVaultSelector(vaults);
  } catch (error) {
    console.error('Failed to fetch vaults:', error);
  }
}

async function getWorkspaces(vaultPath: string) {
  if (!vaultPath) {
    // Clear workspace lists if no vault is selected
    sourceWorkspaceListEl.innerHTML = '';
    targetWorkspaceListEl.innerHTML = '';
    tabListEl.innerHTML = '';
    return;
  }
  try {
    const response = await fetch(`/api/workspaces?vaultPath=${encodeURIComponent(vaultPath)}`);
    currentWorkspaces = await response.json();
    if (currentWorkspaces) {
      populateWorkspaceLists(currentWorkspaces);
    }
  } catch (error) {
    console.error('Failed to fetch workspaces:', error);
    currentWorkspaces = null;
    // On error, clear the lists by passing a default empty object
    populateWorkspaceLists({ workspaces: {}, active: '' });
  }
}

// --- UI Update Functions ---
function updateObsidianStatus(isRunning: boolean | null) {
  if (isRunning === null) {
    obsidianStatusEl.textContent = 'Could not determine Obsidian status. Please ensure the backend server is running.';
    obsidianStatusEl.className = 'status-banner error';
  } else if (isRunning) {
    obsidianStatusEl.textContent = 'Warning: Obsidian is currently running. Please close it before making changes.';
    obsidianStatusEl.className = 'status-banner warning';
  } else {
    obsidianStatusEl.textContent = 'Obsidian is not running. It is safe to make changes.';
    obsidianStatusEl.className = 'status-banner success';
  }
}

function populateVaultSelector(vaults: ObsidianVault[]) {
  if (vaults.length === 0) {
    vaultSelectorEl.innerHTML = '<option>No vaults found</option>';
    return;
  }
  
  vaultSelectorEl.innerHTML = '<option value="">-- Select a Vault --</option>';
  for (const vault of vaults) {
    const option = document.createElement('option');
    option.value = vault.path;
    // Use the folder name as a fallback for the vault name
    option.textContent = vault.name || vault.path.split('/').pop() || vault.path;
    vaultSelectorEl.appendChild(option);
  }
}

function populateWorkspaceLists(data: WorkspacesData) {
  const workspaceNames = Object.keys(data.workspaces);
  sourceWorkspaceListEl.innerHTML = '';
  targetWorkspaceListEl.innerHTML = '';
  tabListEl.innerHTML = '';

  if (workspaceNames.length === 0) {
    const msg = '<p>No workspaces found in this vault.</p>';
    sourceWorkspaceListEl.innerHTML = msg;
    targetWorkspaceListEl.innerHTML = msg;
    return;
  }

  const createWorkspaceItem = (name: string, list: 'source' | 'target') => {
    const div = document.createElement('div');
    div.className = 'workspace-item';
    div.textContent = name;
    div.addEventListener('click', () => {
      const listEl = list === 'source' ? sourceWorkspaceListEl : targetWorkspaceListEl;
      // Allow only one selection per list
      listEl.querySelectorAll('.workspace-item').forEach(el => el.classList.remove('selected'));
      div.classList.add('selected');
      
      if (list === 'source') {
        displayTabsForWorkspace(name);
      }
    });
    return div;
  };

  // Populate both lists
  workspaceNames.forEach(name => {
    sourceWorkspaceListEl.appendChild(createWorkspaceItem(name, 'source'));
    targetWorkspaceListEl.appendChild(createWorkspaceItem(name, 'target'));
  });
}

function displayTabsForWorkspace(workspaceName: string) {
  tabListEl.innerHTML = '';
  if (!currentWorkspaces || !currentWorkspaces.workspaces[workspaceName]) {
    return;
  }

  const workspace = currentWorkspaces.workspaces[workspaceName];
  const tabs = extractTabsFromWorkspace(workspace);

  if (tabs.length === 0) {
    tabListEl.innerHTML = '<p>No open tabs in this workspace.</p>';
    return;
  }

  tabs.forEach(tab => {
    const tr = document.createElement('tr');
    tr.className = 'tab-item';

    // 1. Checkbox cell
    const tdCheckbox = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `tab-${tab.id}`;
    checkbox.value = tab.id;
    tdCheckbox.appendChild(checkbox);

    // 2. Name cell
    const tdName = document.createElement('td');
    tdName.textContent = tab.title;

    // 3. Path cell
    const tdPath = document.createElement('td');
    tdPath.textContent = tab.filePath;
    tdPath.className = 'tab-path';

    tr.appendChild(tdCheckbox);
    tr.appendChild(tdName);
    tr.appendChild(tdPath);
    tabListEl.appendChild(tr);
  });
}

// --- Utility Functions ---
function extractTabsFromWorkspace(workspace: WorkspaceLayout): TabInfo[] {
  const tabs: TabInfo[] = [];
  
  const extractFromNode = (node: LayoutComponent) => {
      if (node.type === 'leaf' && node.state?.state?.file) {
          tabs.push({
              id: node.id,
              filePath: node.state.state.file,
              title: node.state.title || node.state.state.file.split('/').pop() || '',
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

// --- Event Handlers ---
async function handleTabOperation(operation: 'move' | 'copy') {
  const vaultPath = vaultSelectorEl.value;
  const selectedSourceEl = sourceWorkspaceListEl.querySelector('.workspace-item.selected');
  const selectedTargetEl = targetWorkspaceListEl.querySelector('.workspace-item.selected');

  if (!vaultPath || !selectedSourceEl || !selectedTargetEl) {
    alert('Please select a vault, a source workspace, and a target workspace.');
    return;
  }

  const sourceWorkspace = selectedSourceEl.textContent || '';
  const targetWorkspace = selectedTargetEl.textContent || '';
  if (sourceWorkspace === targetWorkspace) {
    alert('Source and target workspaces cannot be the same.');
    return;
  }

  const selectedTabIds = Array.from(tabListEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'))
    .map(cb => cb.value);

  if (selectedTabIds.length === 0) {
    alert('Please select at least one tab to ' + operation);
    return;
  }

  try {
    const response = await fetch(`/api/workspaces/${operation}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vaultPath,
        sourceWorkspace,
        targetWorkspace,
        tabIds: selectedTabIds,
      }),
    });

    const result = await response.json();
    if (response.ok && result.success) {
      alert(`Successfully ${operation}d ${selectedTabIds.length} tabs!`);
      // Refresh the workspace data to show changes
      getWorkspaces(vaultPath);
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    alert(`Failed to ${operation} tabs: ${error}`);
  }
}

// --- Initial Application Logic ---
function main() {
  // Add event listeners
  vaultSelectorEl.addEventListener('change', () => {
    getWorkspaces(vaultSelectorEl.value);
  });

  copyButtonEl.addEventListener('click', () => handleTabOperation('copy'));
  moveButtonEl.addEventListener('click', () => handleTabOperation('move'));

  // Initial data load
  getObsidianStatus();
  getVaults();
}

main();
