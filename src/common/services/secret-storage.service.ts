import { ExtensionContext } from 'vscode';
import { TOKEN_NAME } from '../constants/common.constants';

export class SecretStorageService {
    constructor(private readonly context: ExtensionContext) {}

    public async storeToken(value: string): Promise<void> {
        await this.context.secrets.store(TOKEN_NAME, value);
    }

    public async getToken(): Promise<string> {
        return await this.context.secrets.get(TOKEN_NAME) ?? "";
    }

    public async deleteToken(): Promise<void> {
        await this.context.secrets.delete(TOKEN_NAME);
    }
}
