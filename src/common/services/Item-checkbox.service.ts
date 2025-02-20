import { FilePath, WorkfolderPath } from '../models/common.model';
import { ItemCheckboxType } from '../models/item-checkbox.model';

export class ItemCheckboxService {
    private readonly _workspaceCheckboxes = new Map<WorkfolderPath, ItemCheckboxType>();

    public has(workspace: WorkfolderPath | undefined, url: FilePath): boolean {
        if (!workspace) {
            return false;
        }
        return this.getWorkspace(workspace).has(url);
    }

    public add(workspace: WorkfolderPath | undefined, url: FilePath): void {
        if (!workspace) {
            return;
        }
        this.getWorkspace(workspace).add(url);
    }

    public delete(workspace: WorkfolderPath | undefined, url: FilePath): void {
        if (!workspace) {
            return;
        }
        this.getWorkspace(workspace).delete(url);
    }

    public deleteAll(url: FilePath): void {
        this._workspaceCheckboxes.forEach((value) => value.delete(url));
    }

    public clear(workspace: WorkfolderPath | undefined): void {
        if (!workspace) {
            return;
        }
        this.getWorkspace(workspace).clear();
    }

    public getValues(workspace: WorkfolderPath | undefined): FilePath[] {
        if (!workspace) {
            return [];
        }

        return Array.from(this.getWorkspace(workspace) ?? []);
    }

    private getWorkspace(workspace: WorkfolderPath): ItemCheckboxType {
        let workspaceCheckboxes = this._workspaceCheckboxes.get(workspace);
        if (!workspaceCheckboxes) {
            workspaceCheckboxes = new Set<FilePath>();
            this._workspaceCheckboxes.set(workspace, workspaceCheckboxes);
        }
        return workspaceCheckboxes;
    }
}
