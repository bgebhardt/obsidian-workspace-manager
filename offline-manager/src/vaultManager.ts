import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

interface ObsidianVault {
    path: string;
    ts: number;
    name?: string;
}

interface ObsidianConfig {
    vaults: Record<string, ObsidianVault>;
}

export class VaultManager {
    private async getObsidianConfigPath(): Promise<string> {
        const platform = os.platform();
        const homeDir = os.homedir();

        switch (platform) {
            case 'darwin': // macOS
                return path.join(homeDir, 'Library', 'Application Support', 'obsidian', 'obsidian.json');
            case 'win32': // Windows
                return path.join(homeDir, 'AppData', 'Roaming', 'obsidian', 'obsidian.json');
            case 'linux': // Linux
                return path.join(homeDir, '.config', 'obsidian', 'obsidian.json');
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
    }

    public async getVaults(): Promise<ObsidianVault[]> {
        try {
            const configPath = await this.getObsidianConfigPath();
            const fileContent = await fs.readFile(configPath, 'utf-8');
            const config: ObsidianConfig = JSON.parse(fileContent);

            if (!config.vaults) {
                return [];
            }

            const vaults = Object.values(config.vaults);
            // Sort by last opened time, descending
            vaults.sort((a, b) => b.ts - a.ts);

            return vaults;
        } catch (error) {
            console.error('Error reading Obsidian config:', error);
            // If the file doesn't exist or is invalid, return an empty array
            return [];
        }
    }
}