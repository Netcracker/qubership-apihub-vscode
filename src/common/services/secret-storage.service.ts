import { Event, EventEmitter, ExtensionContext, SecretStorage } from 'vscode';
import { debounce } from '../../utils/files.utils';
import { EXTENSION_NAME } from '../constants/common.constants';

interface SecretStorageData {
    host: string;
    token: string;
}
const SECRET_STORAGE_HOST_KEY = `${EXTENSION_NAME}.secret.host`;
const SECRET_STORAGE_TOKEN_KEY = `${EXTENSION_NAME}.secret.token`;
export class SecretStorageService {
    private readonly _secretStorage: SecretStorage;
    private readonly _onDidChangeConfiguration: EventEmitter<void> = new EventEmitter();
    private readonly fireDebounced = debounce(() => this.fire());
    public readonly onDidChangeConfiguration: Event<void> = this._onDidChangeConfiguration.event;

    public saveHost: Promise<void> = Promise.resolve();
    public saveToken: Promise<void> = Promise.resolve();

    constructor(private readonly context: ExtensionContext) {
        this._secretStorage = this.context.secrets;
    }
    public async getHost(): Promise<string> {
        await this.saveHost;
        return (await this._secretStorage.get(SECRET_STORAGE_HOST_KEY)) ?? '';
    }

    public async setHost(value: string): Promise<boolean> {
        let normalizedUrl = '';
        let isValid = true;
        try {
            normalizedUrl = new URL(value).origin;
        } catch {
            isValid = false;
        }
        this.updateSavePromise(this.saveHost, async () => await this.updateHost(normalizedUrl));

        return isValid;
    }

    public async getToken(): Promise<string> {
        await this.saveToken;
        return (await this._secretStorage.get(SECRET_STORAGE_TOKEN_KEY)) ?? '';
    }

    public async setToken(value: string): Promise<void> {
        await this.saveHost;
        this.updateSavePromise(this.saveToken, async () => this.updateToken(value));
    }

    private async updateHost(value: string): Promise<void> {
        await this._secretStorage.store(SECRET_STORAGE_HOST_KEY, value);
    }

    private async updateToken(value: string): Promise<void> {
        await this._secretStorage.store(SECRET_STORAGE_TOKEN_KEY, value);
    }

    private updateSavePromise(promise: Promise<void>, updateSecretData: () => Promise<void>): void {
        promise = promise.then(updateSecretData).finally(this.fireDebounced);
    }

    private fire(): void {
        this._onDidChangeConfiguration.fire();
    }
}
