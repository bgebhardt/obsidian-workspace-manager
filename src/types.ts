// Complete data model matching workspaces.json structure
export interface WorkspacesData {
  workspaces: Record<string, WorkspaceLayout>;
  active: string;
}

export interface WorkspaceLayout {
  main: LayoutComponent;
  left?: LayoutComponent;
  right?: LayoutComponent;
  active: string;
  mtime: string;
  "workspaces-plus:settings-v1"?: any;
}

export interface LayoutComponent {
  id: string;
  type: "split" | "tabs" | "leaf";
  children?: LayoutComponent[];
  state?: LeafState;
  direction?: "horizontal" | "vertical";
  width?: number;
  collapsed?: boolean;
  currentTab?: number;
}

export interface LeafState {
  type: string;
  state: {
    file?: string;
    mode?: string;
    source?: boolean;
    [key: string]: any;
  };
  icon?: string;
  title?: string;
}

// Simplified tab representation for UI
export interface TabInfo {
  id: string;
  workspaceName: string;
  filePath: string;
  title: string;
  type: string;
  icon?: string;
}