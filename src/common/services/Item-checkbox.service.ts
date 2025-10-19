import { EventEmitter } from 'vscode';
import { FilePath, WorkfolderPath } from '../models/common.model';
import { ItemCheckboxType } from '../models/item-checkbox.model';

export class ItemCheckboxService {
    private readonly _workspaceCheckboxes = new Map<WorkfolderPath, ItemCheckboxType>();
    private readonly _onDidChangeCheckboxes = new EventEmitter<{ workspace: WorkfolderPath; filePath: FilePath; checked: boolean }>();
    public readonly onDidChangeCheckboxes = this._onDidChangeCheckboxes.event;

    public has(workspace: WorkfolderPath | undefined, url: FilePath): boolean {
        return this.performAction(workspace, (checkboxes) => checkboxes.has(url), false);
    }

    public add(workspace: WorkfolderPath | undefined, url: FilePath): void {
        this.performAction(workspace, (checkboxes) => checkboxes.add(url), null);
        if (workspace) {
            this._onDidChangeCheckboxes.fire({ workspace, filePath: url, checked: true });
        }
    }

    public delete(workspace: WorkfolderPath | undefined, url: FilePath): void {
        this.performAction(workspace, (checkboxes) => checkboxes.delete(url), null);
        if (workspace) {
            this._onDidChangeCheckboxes.fire({ workspace, filePath: url, checked: false });
        }
    }

    public deleteAll(url: FilePath): void {
        this._workspaceCheckboxes.forEach((checkboxes) => checkboxes.delete(url));
    }

    public clear(workspace: WorkfolderPath | undefined): void {
        this.performAction(workspace, (checkboxes) => checkboxes.clear(), null);
    }

    public getValues(workspace: WorkfolderPath | undefined): FilePath[] {
        return this.performAction(workspace, (checkboxes) => Array.from(checkboxes), []);
    }

    private performAction<T>(
        workspace: WorkfolderPath | undefined,
        action: (checkboxes: ItemCheckboxType) => T,
        defaultValue: T
    ): T {
        if (!workspace) {
            return defaultValue;
        }
        const checkboxes = this.getOrCreateWorkspaceCheckboxes(workspace);
        return action(checkboxes);
    }

    private getOrCreateWorkspaceCheckboxes(workspace: WorkfolderPath): ItemCheckboxType {
        if (!this._workspaceCheckboxes.has(workspace)) {
            this._workspaceCheckboxes.set(workspace, new Set<FilePath>());
        }
        return this._workspaceCheckboxes.get(workspace)!;
    }
}
