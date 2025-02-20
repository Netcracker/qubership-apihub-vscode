import fs from 'fs';
import path from 'path';
import { Disposable, Event, EventEmitter, Uri, workspace } from 'vscode';
import YAML from 'yaml';
import { convertConfigurationFileToLike, getFilePath, sortStrings } from '../../utils/files.utils';
import { showErrorNotification } from '../../utils/notification.urils';
import { FilePath, WorkfolderPath } from '../models/common.model';
import { ConfigurationData, ConfigurationFile, ConfigurationFileLike } from '../models/configuration.model';
import { PackageId } from '../models/publish.model';

const CONFIG_FILE_NAME = '.apihub-config.yaml';

export class ConfigurationFileService extends Disposable {
    private readonly _configurationFileDates = new Map<WorkfolderPath, ConfigurationData>();
    private readonly _onDidChangeConfigFile: EventEmitter<WorkfolderPath> = new EventEmitter();
    private _disposables: Disposable[] = [];
    private _listeners = new Map<string, Disposable>();
    private readonly onDidChangeConfigFile: Event<WorkfolderPath> = this._onDidChangeConfigFile.event;

    constructor(private readonly workfolderPaths: WorkfolderPath[]) {
        super(() => this.dispose());
        workfolderPaths.forEach((workfolderPath) => {
            const configFilePath = path.join(workfolderPath, CONFIG_FILE_NAME);
            this.calculateConfigFileDataChanged(workfolderPath, configFilePath);
        });
    }

    public subscribe(listenerName: string, listener: (value: WorkfolderPath) => void): void {
        if (this._listeners.has(listenerName)) {
            return;
        }
        if (!this._listeners.size) {
            this.subscribeChanges();
        }
        const disposable: Disposable = this.onDidChangeConfigFile(listener, this, this._disposables);
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

    private subscribeChanges(): void {
        this.workfolderPaths.forEach((workfolderPath: WorkfolderPath) => {
            const configFilePath = path.join(workfolderPath, CONFIG_FILE_NAME);

            const wathcer = workspace.createFileSystemWatcher(configFilePath);
            wathcer.onDidChange(
                () => {
                    if (this.calculateConfigFileDataChanged(workfolderPath, configFilePath)) {
                        this._onDidChangeConfigFile.fire(workfolderPath);
                    }
                },
                this,
                this._disposables
            );
            wathcer.onDidCreate(
                () => {
                    if (this.calculateConfigFileDataChanged(workfolderPath, configFilePath)) {
                        this._onDidChangeConfigFile.fire(workfolderPath);
                    }
                },
                this,
                this._disposables
            );

            if (this.calculateConfigFileDataChanged(workfolderPath, configFilePath)) {
                this._onDidChangeConfigFile.fire(workfolderPath);
            }
        });
    }

    public getConfigurationFile(workfolderPath: WorkfolderPath): ConfigurationFileLike | undefined {
        let configurationData: ConfigurationData | undefined = this._configurationFileDates.get(workfolderPath);
        return configurationData?.config;
    }

    public updateConfigurationFile(workfolderPath: WorkfolderPath, pacakgeId: PackageId, filePaths: FilePath[]): void {
        if (!workfolderPath || !pacakgeId || !filePaths) {
            return;
        }
        const files = sortStrings(filePaths.map((path) => getFilePath(workfolderPath, path)));
        const configFile: ConfigurationFile = {
            pacakgeId,
            files,
            version: 1
        };
        const configFilePath = path.join(workfolderPath, CONFIG_FILE_NAME);
        try {
            fs.writeFileSync(configFilePath, YAML.stringify(configFile), 'utf8');
        } catch (e) {
            console.log();
        }
    }

    public dispose() {
        this._disposables.forEach((disposable) => disposable.dispose());
        this._disposables = [];

        this._listeners.forEach((value: Disposable) => value.dispose());
        this._listeners = new Map();
    }

    private calculateConfigFileDataChanged(workfolderPath: WorkfolderPath, configFilePath: string): boolean {
        let configFileString: string | undefined;
        try {
            configFileString = fs.readFileSync(configFilePath, 'utf8');
        } catch (e) {
            return false;
        }

        const oldConfigFile: ConfigurationData | undefined = this._configurationFileDates.get(workfolderPath);
        if (oldConfigFile?.configString === configFileString) {
            return false;
        }

        let configurationFile: ConfigurationFile;
        try {
            configurationFile = YAML.parse(configFileString);
        } catch (e) {
            showErrorNotification(String(e));
            return false;
        }

        const configurationData: ConfigurationData = {
            config: convertConfigurationFileToLike(configurationFile),
            filePath: Uri.file(configFilePath),
            parentPath: workfolderPath,
            configString: configFileString
        };
        this._configurationFileDates.set(workfolderPath, configurationData);
        return true;
    }
}
