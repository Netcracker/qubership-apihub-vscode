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

    public savePromise: Promise<void> = Promise.resolve();

    constructor(private readonly context: ExtensionContext) {
        this._secretStorage = this.context.secrets;
    }
    public async getHost(): Promise<string> {
        await this.savePromise;
        const secretData = await this.getSecretData();
        return secretData?.host ?? '';
    }

    public setHost(value: string): boolean {
        let normalizedUrl = '';
        let isValid = true;
        try {
            normalizedUrl = new URL(value).origin;
        } catch {
            isValid = false;
        }

        this.updateSavePromise(async () => await this.updateHost(normalizedUrl));

        return isValid;
    }

    public async getToken(): Promise<string> {
        await this.savePromise;
        const secretData = await this.getSecretData();
        return secretData?.token ?? '';
    }

    public setToken(value: string): void {
        this.updateSavePromise(async () => this.updateToken(value));
    }

    private async updateHost(value: string): Promise<void> {
        const secretData = await this.getSecretData();
        secretData.host = value;
        await this.saveSecretData(secretData);
    }

    private async updateToken(value: string): Promise<void> {
        const secretData = await this.getSecretData();
        secretData.token = value;
        await this.saveSecretData(secretData);
    }

    private updateSavePromise(updateSecretData: () => Promise<void>): void {
        this.savePromise = this.savePromise.then(updateSecretData).finally(this.fireDebounced);
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
        return this._secretStorage.store(SECRET_STORAGE_KEY, JSON.stringify(data));
    }
}
