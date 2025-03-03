import { Event, EventEmitter, ExtensionContext, workspace, WorkspaceConfiguration } from 'vscode';
import { debounce } from '../../utils/files.utils';
import { SETTINGS_GROUP } from '../constants/common.constants';
import { SecretStorageService } from './secret-storage.service';

const HOST_URL = 'portalURL';
export class ConfigurationService {
    private readonly secretStorageService: SecretStorageService;
    private readonly _onDidChangeConfiguration: EventEmitter<void> = new EventEmitter();
    private readonly fireDebounced = debounce(() => this.fire());
    public readonly onDidChangeConfiguration: Event<void> = this._onDidChangeConfiguration.event;

    constructor(readonly context: ExtensionContext) {
        this.secretStorageService = new SecretStorageService(context);
    }
    /* Сall this every time, otherwise the settings will not be updated */
    private get workspaceConfiguration(): WorkspaceConfiguration {
        return workspace.getConfiguration(SETTINGS_GROUP);
    }

    public get hostUrl(): string {
        return this.workspaceConfiguration.get(HOST_URL) ?? '';
    }

    public set hostUrl(url: string) {
        this.workspaceConfiguration.update(HOST_URL, url);
        this.fireDebounced();
    }

    public storeToken(value: string): void {
        this.secretStorageService.storeToken(value);
        this.fireDebounced();
    }

    public async getToken(): Promise<string> {
        return this.secretStorageService.getToken();
    }

    public async deleteToken(): Promise<void> {
        this.fireDebounced();
        return this.secretStorageService.deleteToken();
    }

    private fire(): void {
        this._onDidChangeConfiguration.fire();
    }
}
