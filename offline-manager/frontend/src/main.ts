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
const openVaultLinkEl = document.querySelector<HTMLAnchorElement>('#open-vault-link')!;
const sourceWorkspaceListEl = document.querySelector<HTMLDivElement>('#source-workspace-list')!;
const targetWorkspaceListEl = document.querySelector<HTMLDivElement>('#target-workspace-list')!;
const tabListEl = document.querySelector<HTMLTableSectionElement>('#tab-list')!;
const copyButtonEl = document.querySelector<HTMLButtonElement>('#copy-button')!;
const moveButtonEl = document.querySelector<HTMLButtonElement>('#move-button')!;
const deleteButtonEl = document.querySelector<HTMLButtonElement>('#delete-button')!;

// --- Type Definitions ---
interface ObsidianStatus {
    isRunning: boolean;
    openVaults?: string[];
}

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
    const data: ObsidianStatus = await response.json();
    updateObsidianStatus(data);
  } catch (error) {
    console.error('Failed to fetch Obsidian status:', error);
    updateObsidianStatus({ isRunning: false }); // Assume not running on error
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
function updateObsidianStatus(status: ObsidianStatus | null) {
  if (status === null) {
    obsidianStatusEl.innerHTML = '<span>Could not determine Obsidian status. Please ensure the backend server is running.</span>';
    obsidianStatusEl.className = 'status-banner error';
  } else if (status.isRunning) {
    let warningText = 'Warning: Obsidian is currently running. Please close it before making changes.';
    if (status.openVaults && status.openVaults.length > 0) {
        warningText += `<br>Open vaults: <strong>${status.openVaults.join(', ')}</strong>.`;
    }

    obsidianStatusEl.innerHTML = `<span>${warningText}</span>`;
    
    // Only show the quit button on Mac
    if (navigator.platform.toUpperCase().indexOf('MAC') >= 0) {
      const quitButton = document.createElement('button');
      quitButton.textContent = 'Quit Obsidian';
      quitButton.className = 'quit-button';
      quitButton.addEventListener('click', async () => {
        try {
          quitButton.textContent = 'Quitting...';
          quitButton.disabled = true;
          await fetch('/api/obsidian/quit', { method: 'POST' });
          // Wait a moment for the process to terminate before re-checking
          setTimeout(getObsidianStatus, 2000);
        } catch (error) {
          alert('Failed to send quit command.');
          quitButton.textContent = 'Quit Obsidian';
          quitButton.disabled = false;
        }
      });
      obsidianStatusEl.appendChild(quitButton);
    }

    obsidianStatusEl.className = 'status-banner warning';
  } else {
    obsidianStatusEl.innerHTML = '<span>Obsidian is not running. It is safe to make changes.</span>';
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
    const vaultName = vault.name || vault.path.split('/').pop() || vault.path;
    option.value = vault.path;
    option.textContent = vaultName;
    option.dataset.vaultName = vaultName; // Store vault name for URI
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

async function handleDeleteOperation() {
  const vaultPath = vaultSelectorEl.value;
  const selectedSourceEl = sourceWorkspaceListEl.querySelector('.workspace-item.selected');

  if (!vaultPath || !selectedSourceEl) {
    alert('Please select a vault and a source workspace.');
    return;
  }

  const workspaceName = selectedSourceEl.textContent || '';
  const selectedTabIds = Array.from(tabListEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'))
    .map(cb => cb.value);

  if (selectedTabIds.length === 0) {
    alert('Please select at least one tab to delete.');
    return;
  }

  if (!confirm(`Are you sure you want to delete ${selectedTabIds.length} tabs from the "${workspaceName}" workspace? This cannot be undone.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/workspaces/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vaultPath,
        workspaceName,
        tabIds: selectedTabIds,
      }),
    });

    const result = await response.json();
    if (response.ok && result.success) {
      alert(`Successfully deleted ${selectedTabIds.length} tabs!`);
      // Refresh the workspace data to show changes
      getWorkspaces(vaultPath);
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    alert(`Failed to delete tabs: ${error}`);
  }
}


// --- Initial Application Logic ---
function main() {
  // Add event listeners
  vaultSelectorEl.addEventListener('change', () => {
    const selectedVaultPath = vaultSelectorEl.value;
    const selectedOption = vaultSelectorEl.options[vaultSelectorEl.selectedIndex];
    const vaultName = selectedOption ? selectedOption.dataset.vaultName : null;

    if (selectedVaultPath && vaultName) {
      openVaultLinkEl.href = `obsidian://open?vault=${encodeURIComponent(vaultName)}`;
      openVaultLinkEl.hidden = false;
    } else {
      openVaultLinkEl.hidden = true;
    }

    getWorkspaces(selectedVaultPath);
  });

  copyButtonEl.addEventListener('click', () => handleTabOperation('copy'));
  moveButtonEl.addEventListener('click', () => handleTabOperation('move'));
  deleteButtonEl.addEventListener('click', handleDeleteOperation);

  // Initial data load
  getObsidianStatus();
  getVaults();
}

main();
