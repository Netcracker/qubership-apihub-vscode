import { Disposable, Event, EventEmitter, TextEditor, Uri, window, workspace } from 'vscode';
import { WorkfolderPath } from '../models/common.model';

export class WorkspaceService extends Disposable {
    private _disposables: Disposable[] = [];
    private _activeWorkfolderPath: WorkfolderPath = "";
    private _workfolderPaths: WorkfolderPath[] = [];
    private _listeners = new Map<string, Disposable>();
    private readonly _onDidChangeActiveWorkspace: EventEmitter<WorkfolderPath> = new EventEmitter();
    private readonly onDidChangeActiveWorkspace: Event<WorkfolderPath> = this._onDidChangeActiveWorkspace.event;

    constructor(readonly workfolderPaths: WorkfolderPath[]) {
        super(() => this.dispose());

        this.updateWorkfolderPaths(workfolderPaths);
        this.subscribeChanges();
    }

    public updateWorkfolderPaths(workfolderPaths: WorkfolderPath[]): void {
        this._workfolderPaths = workfolderPaths;
        this._activeWorkfolderPath = this.getActiveWorkspace();
    }

    public subscribe(listenerName: string, listener: (value: WorkfolderPath) => void): void {
        if (this._listeners.has(listenerName)) {
            return;
        }
        if (!this._listeners.size) {
            this._activeWorkfolderPath = this.getActiveWorkspace();
            this.subscribeChanges();
        }
        const disposable: Disposable = this.onDidChangeActiveWorkspace(listener, this, this._disposables);
        this._listeners.set(listenerName, disposable);
    }

    public unsubscribe(listenerName: string): void {
        if (!this._listeners.has(listenerName)) {
            return;
        }
        this._listeners.get(listenerName)?.dispose();
        this._listeners.delete(listenerName);

        if (!this._listeners.size) {
            this.dispose();
        }
    }

    public get activeWorkfolderPath(): WorkfolderPath {
        return this._activeWorkfolderPath;
    }

    public dispose() {
        this._disposables.forEach((disposable) => disposable.dispose());
        this._disposables = [];

        this._listeners.forEach((value: Disposable) => value.dispose());
        this._listeners = new Map();
    }

    private subscribeChanges(): void {
        window.onDidChangeActiveTextEditor(
            (data: TextEditor | undefined) => {
                if (!data || this._workfolderPaths.length === 1) {
                    return;
                }
                this._activeWorkfolderPath = this.getActiveWorkspace();
                this._onDidChangeActiveWorkspace.fire(this._activeWorkfolderPath);
            },
            this,
            this._disposables
        );
    }

    private getActiveWorkspace(): WorkfolderPath {
        const fileUri: Uri | undefined = window.activeTextEditor?.document.uri;
        if (fileUri) {
            return workspace.getWorkspaceFolder(fileUri)?.uri?.fsPath ?? this._workfolderPaths[0];
        } else {
            return this._workfolderPaths[0];
        }
    }
}
