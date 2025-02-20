import * as vscode from 'vscode';
import { SETTINGS_GROUP } from '../constants/common.constants';

const HOST_URL = 'portalURL';
class ConfigurationService {
    /* Сall this every time, otherwise the settings will not be updated */
    private get workspaceConfiguration(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(SETTINGS_GROUP);
    }

    public get hostUrl(): string {
        return this.workspaceConfiguration.get(HOST_URL) ?? "";
    }

    public set hostUrl(url: string) {
        this.workspaceConfiguration.update(HOST_URL, url);
    }
}

export const configurationService = new ConfigurationService();
