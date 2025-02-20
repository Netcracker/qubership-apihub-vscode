import fs from 'fs';
import { Uri } from 'vscode';
import { NODE_MODULES_PATH, RESOURCES_PATH, TEMPLATE_PATH } from '../common/constants/common.constants';

export async function getHtmlContent(filePath: string, data: Record<string, string | Uri>): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, content) => {
            if (err) {
                reject(err);
            }
            const filledContent = content.replace(/{{(.*?)}}/g, (_, key) => data[key.trim()] as string);
            resolve(filledContent);
        });
    });
}

export function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function getElements(extensionUri: Uri): Uri {
    return Uri.joinPath(extensionUri, NODE_MODULES_PATH, '@vscode-elements/elements', 'dist', 'bundled.js');
}
export function getElements2(extensionUri: Uri, str: string): Uri {
    return Uri.joinPath(extensionUri, NODE_MODULES_PATH, '@vscode-elements/elements', 'dist', str, 'index.js');
}

export function getJsScript(extensionUri: Uri, jsName: string): Uri {
    return Uri.joinPath(extensionUri, RESOURCES_PATH, 'template', 'js', jsName);
}

export function getStyle(extensionUri: Uri): Uri {
    return Uri.joinPath(extensionUri, RESOURCES_PATH, TEMPLATE_PATH, 'css', 'main.css');
}

export function getCodicon(extensionUri: Uri): Uri {
    return Uri.joinPath(extensionUri, NODE_MODULES_PATH, '@vscode/codicons', 'dist', 'codicon.css');
}
