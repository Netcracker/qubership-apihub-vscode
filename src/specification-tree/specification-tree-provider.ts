import fs, { Dirent } from 'fs';
import path from 'path';
import {
    Disposable,
    Event,
    EventEmitter,
    FileSystemWatcher,
    TreeDataProvider,
    TreeItemCheckboxState,
    Uri,
    window,
    workspace
} from 'vscode';
import {
    IGNORE_DIRS,
    OPENAPI_SPEC_KEY_REGEXP,
    SPECIFICATION_TREE,
    SPECS_ADDITIONALS as SPECS_ADDITIONAL_EXTENSIONS,
    SPECS_EXTENSIONS as SPECS_MAIN_EXTENSIONS
} from '../common/constants/specification.constants';
import { FilePath, WorkfolderPath } from '../common/models/common.model';
import { ConfigurationFileLike, ConfigurationId } from '../common/models/configuration.model';
import { SpecificationItem } from '../common/models/specification-item';
import { ItemCheckboxService } from '../common/services/Item-checkbox.service';
import { ConfigurationFileService } from '../common/services/configuration-file.service';
import { WorkspaceService } from '../common/services/workspace.service';
import { getExtension as getFileExtension, isApispecFile, isPathExists } from '../utils/files.utils';
import { showInformationMessage } from '../utils/notification.urils';

export class SpecificationFileTreeProvider extends Disposable implements TreeDataProvider<SpecificationItem> {
    private readonly _onDidChangeTreeData: EventEmitter<void> = new EventEmitter();
    public readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event;
    private _disposables: Disposable[] = [];
    private readonly _watcher: FileSystemWatcher;

    private readonly _localFiles: Map<WorkfolderPath, Set<FilePath>> = new Map();
    private readonly _configFiles: Map<WorkfolderPath, Set<FilePath>> = new Map();
    private readonly _configId: Map<WorkfolderPath, ConfigurationId> = new Map();

    constructor(
        private readonly workspaceFolderService: WorkspaceService,
        private readonly itemCheckboxService: ItemCheckboxService,
        private readonly configurationFileService: ConfigurationFileService
    ) {
        super(() => this.dispose());
        const apispecFileExtensions: string = [...SPECS_MAIN_EXTENSIONS, ...SPECS_ADDITIONAL_EXTENSIONS].join(',');
        this._watcher = workspace.createFileSystemWatcher(`**/*.{${apispecFileExtensions}}`);
        this.setFilesFromConfig(this.workspaceFolderService.activeWorkspace);
    }

    public activate(active: boolean): void {
        if (active) {
            const activeWorkspace = this.workspaceFolderService.activeWorkspace;
            this.setFilesFromConfig(activeWorkspace);
            this.subscribeChanges();
            this.refresh();
        } else {
            this.dispose();
        }
    }

    public getTreeItem(element: SpecificationItem): SpecificationItem {
        return element;
    }

    public getChildren(): Thenable<SpecificationItem[]> {
        const workspace = this.workspaceFolderService.activeWorkspace;
        return this.getChildrenFromWorkspace(workspace);
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    public async getFilesForPublish(): Promise<SpecificationItem[]> {
        const activeWorkspace = this.workspaceFolderService.activeWorkspace;
        this.setFilesFromConfig(activeWorkspace);
        const items = await this.getChildrenFromWorkspace(activeWorkspace);
        return await Promise.all(items.filter(async (item: SpecificationItem) => isPathExists(item.uri.fsPath)));
    }

    public dispose() {
        this._disposables.forEach((disposable) => disposable.dispose());
        this._disposables = [];
        this.workspaceFolderService.unsubscribe(SPECIFICATION_TREE);
        this.configurationFileService.unsubscribe(SPECIFICATION_TREE);
    }

    private getChildrenFromWorkspace(workspace: WorkfolderPath): Thenable<SpecificationItem[]> {
        if (!workspace) {
            showInformationMessage('No specifications in empty workspace');
            return Promise.resolve([]);
        }
        if (!isPathExists(workspace)) {
            window.showInformationMessage(`Invalid path for ${workspace}`);
            return Promise.resolve([]);
        }
        const configFiles: Set<FilePath> = this._configFiles.get(workspace) ?? new Set();
        const localFiles: Set<FilePath> = this.getLocalFiles(workspace);
        const configFileExist = !!configFiles?.size;
        return Promise.resolve(
            this.readSpecificationFiles(workspace, workspace, localFiles, configFiles, configFileExist)
        );
    }

    private readSpecificationFiles(
        dirPath: string,
        workfolderPath: WorkfolderPath,
        localFiles: Set<FilePath>,
        configFiles: Set<FilePath>,
        configFileExist: boolean
    ): SpecificationItem[] {
        const specItems: SpecificationItem[] = [];
        const dirents: Dirent[] = fs.readdirSync(dirPath, { withFileTypes: true });
        dirents.forEach((dirent) => {
            const { name, parentPath } = dirent;
            const path = `${parentPath}\\${name}`;

            if (IGNORE_DIRS.includes(name)) {
                return;
            }
            if (dirent.isDirectory()) {
                specItems.push(
                    ...this.readSpecificationFiles(path, workfolderPath, localFiles, configFiles, configFileExist)
                );
                return;
            }
            if (!dirent.isFile()) {
                return;
            }
            if (!configFiles.has(path) && !this.isSpecificationFile(path)) {
                return;
            }

            let selectd = this.calculateItemSelected(workfolderPath, path, localFiles, configFiles, configFileExist);
            specItems.push(
                new SpecificationItem(
                    name,
                    dirent.parentPath,
                    Uri.file(path),
                    workfolderPath,
                    selectd ? TreeItemCheckboxState.Checked : TreeItemCheckboxState.Unchecked
                )
            );
        });

        return this.sortSpecificationItems(specItems);
    }

    private calculateItemSelected(
        workfolderPath: WorkfolderPath,
        path: FilePath,
        localFiles: Set<FilePath>,
        configFiles: Set<FilePath>,
        configFileExist: boolean
    ): boolean {
        if (this.itemCheckboxService.has(workfolderPath, path)) {
            return true;
        }
        if (localFiles.has(path)) {
            return false;
        }
        localFiles.add(path);
        const selected = configFileExist ? configFiles.has(path) : true;
        if (selected) {
            this.itemCheckboxService.add(workfolderPath, path);
        }
        return selected;
    }

    private sortSpecificationItems(specItems: SpecificationItem[]): SpecificationItem[] {
        return specItems.sort((firstValue, secondValue) => secondValue.label.localeCompare(firstValue.label));
    }

    private isSpecificationFile(path: FilePath): boolean {
        const extension = getFileExtension(path);
        if (!extension) {
            return false;
        }
        if (extension && SPECS_ADDITIONAL_EXTENSIONS.includes(extension)) {
            return true;
        }
        if (isApispecFile(extension)) {
            return !!fs.readFileSync(path, 'utf8').match(OPENAPI_SPEC_KEY_REGEXP);
        }
        return false;
    }

    private subscribeChanges(): void {
        this._watcher.onDidChange(() => this.refresh(), this, this._disposables);
        this._watcher.onDidCreate(() => this.refresh(), this, this._disposables);
        this._watcher.onDidDelete(
            (deletedFile: Uri) => this.cleanCheckboxAfterDelete(deletedFile),
            this,
            this._disposables
        );

        this.configurationFileService.subscribe(SPECIFICATION_TREE, (workspacePath: WorkfolderPath) => {
            this.setFilesFromConfig(workspacePath);
            if (this.workspaceFolderService.activeWorkspace === workspacePath) {
                this.refresh();
            }
        });
        this.workspaceFolderService.subscribe(SPECIFICATION_TREE, () => this.refresh());
    }

    private cleanCheckboxAfterDelete(deletedFile: Uri): void {
        const filePath = deletedFile.fsPath;
        this.itemCheckboxService.deleteAll(filePath);
        this.getLocalFiles(this.workspaceFolderService.activeWorkspace).delete(filePath);
        this.refresh();
    }

    private setFilesFromConfig(workfolderPath: WorkfolderPath): void {
        const configFile: ConfigurationFileLike | undefined =
            this.configurationFileService.getConfigurationFile(workfolderPath);

        const oldConfigFileId: string | undefined = this._configId.get(workfolderPath);
        if (!configFile || configFile.id === oldConfigFileId) {
            return;
        }
        this._configId.set(workfolderPath, configFile.id);
        this.itemCheckboxService.clear(workfolderPath);
        this._configFiles.delete(workfolderPath);

        const files: Set<FilePath> = new Set();
        configFile.files.forEach((filePath) => {
            const fullFilePath = path.join(workfolderPath, filePath);
            this.itemCheckboxService.add(workfolderPath, fullFilePath);
            files.add(fullFilePath);
        });
        this._configFiles.set(workfolderPath, files);
    }

    private getLocalFiles(workspace: WorkfolderPath): Set<FilePath> {
        if (!this._localFiles.has(workspace)) {
            const filesArray = new Set<FilePath>();
            this._localFiles.set(workspace, filesArray);
            return filesArray;
        }
        return this._localFiles.get(workspace) as Set<FilePath>;
    }
}
