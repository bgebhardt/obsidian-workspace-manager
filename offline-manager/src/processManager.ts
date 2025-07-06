import * as os from 'os';
import { execute } from 'node-osascript';

export class ProcessManager {
    private async isObsidianRunningMac(): Promise<boolean> {
        const script = 'tell application "System Events" to (name of processes) contains "Obsidian"';
        return new Promise((resolve) => {
            execute(script, (err: Error | null, result: any) => {
                if (err) {
                    console.error("AppleScript error:", err);
                    // Fallback to ps-list on AppleScript error
                    this.isObsidianRunningPsList().then(resolve);
                    return;
                }
                resolve(result as boolean);
            });
        });
    }

    private async isObsidianRunningPsList(): Promise<boolean> {
        // Dynamically import ps-list as it's an ES Module
        const { default: psList } = await import('ps-list');
        const processes = await psList();
        
        // Check for any process name that includes "obsidian", case-insensitive.
        return processes.some(p => p.name.toLowerCase().includes('obsidian'));
    }

    public async isObsidianRunning(): Promise<boolean> {
        if (os.platform() === 'darwin') {
            return this.isObsidianRunningMac();
        } else {
            return this.isObsidianRunningPsList();
        }
    }
}