import * as os from 'os';
import { execute } from 'node-osascript';

export interface ObsidianStatus {
    isRunning: boolean;
    openVaults?: string[];
}

export class ProcessManager {
    private async getMacObsidianStatus(): Promise<ObsidianStatus> {
        const script = `
            tell application "System Events"
                set isRunning to (name of processes) contains "Obsidian"
            end tell
            if isRunning then
                try
                    tell application "Obsidian"
                        set windowNames to name of windows
                    end tell
                    return {isRunning:true, openVaults:windowNames}
                on error
                    return {isRunning:true, openVaults:{}}
                end try
            else
                return {isRunning:false, openVaults:{}}
            end if
        `;
        return new Promise((resolve) => {
            execute(script, (err: Error | null, result: any) => {
                if (err || !result) {
                    console.error("AppleScript error getting status:", err);
                    // Fallback to ps-list on AppleScript error
                    this.isObsidianRunningPsList().then(psResult => resolve({ isRunning: psResult }));
                    return;
                }
                // osascript returns a record; we need to parse the vault names
                const vaults = (result.openVaults || []).map((w: string) => w.split(' – ')[0]);
                resolve({ isRunning: result.isRunning, openVaults: vaults });
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

    public async getObsidianStatus(): Promise<ObsidianStatus> {
        if (os.platform() === 'darwin') {
            return this.getMacObsidianStatus();
        } else {
            const isRunning = await this.isObsidianRunningPsList();
            return { isRunning };
        }
    }

    public async quitObsidian(): Promise<void> {
        if (os.platform() !== 'darwin') {
            // This should not be callable from the UI on non-mac platforms, but as a safeguard:
            console.warn('Attempted to quit Obsidian on a non-mac platform.');
            return;
        }
        const script = 'tell application "Obsidian" to quit';
        return new Promise((resolve, reject) => {
            execute(script, (err: Error | null) => {
                if (err) {
                    console.error("AppleScript error quitting Obsidian:", err);
                    return reject(err);
                }
                resolve();
            });
        });
    }
}