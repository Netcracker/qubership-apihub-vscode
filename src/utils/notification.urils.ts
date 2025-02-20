import { window } from 'vscode';

export function showErrorNotification(message: string): void {
    window.showErrorMessage(message);
}

export function showInformationMessage(message: string): void {
    window.showInformationMessage(message);
}
export function showInformationMessageButton(message: string): void {
    window.showInformationMessage(message);
}
