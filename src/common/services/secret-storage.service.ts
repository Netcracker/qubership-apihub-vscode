import { Event, EventEmitter, ExtensionContext, SecretStorage } from 'vscode';
import { debounce } from '../../utils/files.utils';
import { EXTENSION_NAME } from '../constants/common.constants';

const SECRET_STORAGE_HOST_KEY = `${EXTENSION_NAME}.secret.host`;
const SECRET_STORAGE_TOKEN_KEY = `${EXTENSION_NAME}.secret.token`;
const SECRET_STORAGE_KEY = `${EXTENSION_NAME}.secret`;
export class SecretStorageService {
    private readonly _secretStorage: SecretStorage;
    private readonly _onDidChangeConfiguration: EventEmitter<void> = new EventEmitter();
    private readonly fireDebounced = debounce(() => this.fire());
    public readonly onDidChangeConfiguration: Event<void> = this._onDidChangeConfiguration.event;

    private saveQueue: Promise<void> = Promise.resolve(); 

    constructor(private readonly context: ExtensionContext) {
        this._secretStorage = this.context.secrets;
    }
    public async getHost(): Promise<string> {
        await this.saveQueue;
        const secretString = await this._secretStorage.get(SECRET_STORAGE_KEY);
        const secrets = secretString ? JSON.parse(secretString) : {};
        return secrets[SECRET_STORAGE_HOST_KEY];
    }

    public async  setHost(value: string): Promise<void>  {
        await this.updateSecretKey(SECRET_STORAGE_HOST_KEY, value);
        this.fireDebounced();
    }

    public async getToken(): Promise<string> {
        await this.saveQueue;
        const secretString = await this._secretStorage.get(SECRET_STORAGE_KEY);
        const secrets = secretString ? JSON.parse(secretString) : {};
        return secrets[SECRET_STORAGE_TOKEN_KEY];
    }

    public async setToken(value: string): Promise<void>  {
        await this.updateSecretKey(SECRET_STORAGE_TOKEN_KEY, value);
        this.fireDebounced();
    }

    private fire(): void {
        this._onDidChangeConfiguration.fire();
    }

    private async updateSecretKey(key: string, value: string): Promise<void> {
        this.saveQueue = this.saveQueue.then(async () => {
            const secretString = await this._secretStorage.get(SECRET_STORAGE_KEY);
            const secretObj = secretString ? JSON.parse(secretString) : {};
            secretObj[key] = value;
            await this._secretStorage.store(SECRET_STORAGE_KEY, JSON.stringify(secretObj));
        });

        return this.saveQueue;
    }

}
