import { Event, EventEmitter, ExtensionContext, SecretStorage } from 'vscode';
import { debounce } from '../../utils/files.utils';
import { EXTENSION_NAME } from '../constants/common.constants';

interface SecretStorageData {
    host: string;
    token: string;
}
const SECRET_STORAGE_KEY = `${EXTENSION_NAME}.secret`;
export class SecretStorageService {
    private readonly _secretStorage: SecretStorage;
    private readonly _onDidChangeConfiguration: EventEmitter<void> = new EventEmitter();
    private readonly fireDebounced = debounce(() => this.fire());
    public readonly onDidChangeConfiguration: Event<void> = this._onDidChangeConfiguration.event;

    constructor(private readonly context: ExtensionContext) {
        this._secretStorage = this.context.secrets;
    }
    public async getHost(): Promise<string> {
        const secretData = await this.getSecretData();
        return secretData?.host ?? '';
    }

    public async setHost(value: string): Promise<boolean> {
        const secretData = await this.getSecretData();

        let isValid = true;
        try {
            secretData.host = new URL(value).origin;
        } catch {
            secretData.host = '';
            isValid = false;
        }
        await this.saveSecretData(secretData);
        this.fireDebounced();
        
        return isValid;
    }

    public async getToken(): Promise<string> {
        const secretData = await this.getSecretData();
        return secretData?.token ?? '';
    }

    public async setToken(value: string): Promise<void> {
        const secretData = await this.getSecretData();
        secretData.token = value;
        await this.saveSecretData(secretData);
        this.fireDebounced();
    }

    private fire(): void {
        this._onDidChangeConfiguration.fire();
    }

    private async getSecretData(): Promise<SecretStorageData> {
        const storedValue = await this._secretStorage.get(SECRET_STORAGE_KEY);
        let secretStorageData: SecretStorageData = { host: '', token: '' };
        if (!storedValue) {
            return secretStorageData;
        }
        try {
            secretStorageData = JSON.parse(storedValue);
        } catch {}
        return secretStorageData;
    }

    private async saveSecretData(data: SecretStorageData): Promise<void> {
        await this._secretStorage.store(SECRET_STORAGE_KEY, JSON.stringify(data));
    }
}
