import * as os from 'os';

export class ProcessManager {
    private getProcessName(): string {
        const platform = os.platform();
        switch (platform) {
            case 'darwin': // macOS
                return 'Obsidian';
            case 'win32': // Windows
                return 'Obsidian.exe';
            case 'linux': // Linux
                return 'obsidian'; // This might vary by distribution/installation method
            default:
                return 'Obsidian'; // Default fallback
        }
    }

    public async isObsidianRunning(): Promise<boolean> {
        // Dynamically import ps-list as it's an ES Module
        const { default: psList } = await import('ps-list');
        const processes = await psList();
        const obsidianProcessName = this.getProcessName();
        
        return processes.some(p => p.name === obsidianProcessName);
    }
}