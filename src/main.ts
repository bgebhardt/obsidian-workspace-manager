import { Plugin, PluginSettingTab, App, Setting } from 'obsidian';
import { WorkspaceManager } from './WorkspaceManager';
import { WorkspaceManagerModal } from './WorkspaceManagerModal';
import { WorkspaceManagerSettings, DEFAULT_SETTINGS } from './types';
import { Logger } from './Logger';

export default class WorkspaceManagerPlugin extends Plugin {
    workspaceManager!: WorkspaceManager;
    settings!: WorkspaceManagerSettings;

    async onload() {
        await this.loadSettings();
        Logger.setDebug(this.settings.debug);
        Logger.info('Loading Workspace Manager plugin');


        this.workspaceManager = new WorkspaceManager(this.app, this.settings);

        // Add ribbon icon
        this.addRibbonIcon('folder', 'Workspace Manager', () => {
            if (this.workspaceManager.isPluginEnabled()) {
                new WorkspaceManagerModal(this.app, this.workspaceManager).open();
            }
        });
        Logger.info('Added ribbon icon for Workspace Manager');

        // Add command
        this.addCommand({
            id: 'open-workspace-manager',
            name: 'Open Workspace Manager',
            callback: () => {
                Logger.info('Opening Workspace Manager Modal');
                if (this.workspaceManager.isPluginEnabled()) {
                    new WorkspaceManagerModal(this.app, this.workspaceManager).open();
                }
            }
        });
        Logger.info('Added command: open-workspace-manager');

        this.addSettingTab(new WorkspaceManagerSettingTab(this.app, this));
    }

    onunload() {
        Logger.info('Unloading Workspace Manager plugin');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        Logger.setDebug(this.settings.debug);
    }
}

class WorkspaceManagerSettingTab extends PluginSettingTab {
    plugin: WorkspaceManagerPlugin;

    constructor(app: App, plugin: WorkspaceManagerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'Workspace Manager Settings'});

        new Setting(containerEl)
            .setName('Enable Debug Logging')
            .setDesc('Turns on verbose logging to the console.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debug)
                .onChange(async (value) => {
                    this.plugin.settings.debug = value;
                    await this.plugin.saveSettings();
                }));
    }
}