export interface WorkspaceManagerSettings {
    backupLocation: string;
    maxBackups: number;
    debug: boolean;
}

export const DEFAULT_SETTINGS: WorkspaceManagerSettings = {
    backupLocation: '.obsidian/backups',
    maxBackups: 10,
    debug: true
};