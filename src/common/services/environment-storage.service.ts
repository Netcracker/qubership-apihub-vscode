import { Event, EventEmitter, ExtensionContext, SecretStorage, window } from 'vscode';
import { debounce } from '../../utils/files.utils';
import { EXTENSION_NAME } from '../constants/common.constants';

const SECRET_STORAGE_KEY = `${EXTENSION_NAME}.secret.environment`;

export interface EnvironmentData {
    host: string;
    token: string;
}

export class EnvironmentStorageService {
    private readonly _secretStorage: SecretStorage;
    private readonly _onDidChangeConfiguration: EventEmitter<EnvironmentData> = new EventEmitter();
    private readonly fireDebounced = debounce(() => this.fire());
    private readonly saveDebounced = debounce(() => {
        this.saveEnvironmentToStorage();
        this.fireDebounced();
    });
    public readonly onDidChangeConfiguration: Event<EnvironmentData> = this._onDidChangeConfiguration.event;

    private _host: string = '';
    private _token: string = '';

    constructor(private readonly context: ExtensionContext) {
        this._secretStorage = this.context.secrets;
        this.getEnvironmentFromStorage();
    }

    public async getEnvironment(): Promise<EnvironmentData> {
        return this.getLocalEnvironmentData();
    }

    public async setHost(value: string): Promise<void> {
        this._host = value;
        this.saveDebounced();
    }

    public async setToken(value: string): Promise<void> {
        this._token = value;
        this.saveDebounced();
    }

    private fire(): void {
        this._onDidChangeConfiguration.fire(this.getLocalEnvironmentData());
    }

    private async saveEnvironmentToStorage(): Promise<void> {
        const environmentData: EnvironmentData = this.getLocalEnvironmentData();
        let value = '';
        try {
            value = JSON.stringify(environmentData);
        } catch {}
        await this._secretStorage.store(SECRET_STORAGE_KEY, value);
        const now = new Date();
const time = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
        window.showInformationMessage(`${time}, ${value}`);
    }

    private async getEnvironmentFromStorage(): Promise<void> {
        const value: string = (await this._secretStorage.get(SECRET_STORAGE_KEY)) ?? '';
        try {
            const { host, token } = JSON.parse(value) as EnvironmentData;
            this._host = host ?? '';
            this._token = token ?? '';
        } catch {}
    }

    private getLocalEnvironmentData(): EnvironmentData {
        return { host: this._host, token: this._token };
    }
}
