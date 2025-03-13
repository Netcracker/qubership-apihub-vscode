import { JSONSchemaType } from 'ajv';
import fs from 'fs';
import path from 'path';
import { Disposable, Event, EventEmitter, Uri, window, workspace } from 'vscode';
import YAML from 'yaml';
import { convertConfigurationFileToLike, validateYAML } from '../../utils/files.utils';
import { getFilePath, sortStrings } from '../../utils/path.utils';
import {
    CONFIGURATION_FILE_NOT_VALID_ERROR_MESSAGE,
    CONFIGURATION_FILE_UNABLE_TO_READ_ERROR_MESSAGE,
    CONFIGURATION_UNABLE_TO_CREATE_ERROR_MESSAGE
} from '../constants/configuration-file.constants';
import { FilePath, WorkfolderPath } from '../models/common.model';
import { ConfigurationData, ConfigurationFile, ConfigurationFileLike } from '../models/configuration.model';
import { PackageId } from '../models/publish.model';

const CONFIG_FILE_NAME = '.apihub-config.yaml';
const CONFIG_FILE_SCHEMA: JSONSchemaType<{ packageId: string; files: string[]; version: number }> = {
    type: 'object',
    properties: {
        packageId: { type: 'string' },
        files: {
            type: 'array',
            items: { type: 'string' }
        },
        version: { type: 'number' }
    },
    required: ['packageId', 'files', 'version']
};

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

    public updateConfigurationFile(workfolderPath: WorkfolderPath, packageId: PackageId, filePaths: FilePath[]): void {
        if (!workfolderPath || !packageId || !filePaths) {
            return;
        }
        const files = sortStrings(filePaths.map((path) => getFilePath(workfolderPath, path)));
        const configFile: ConfigurationFile = {
            packageId: packageId,
            files,
            version: 1
        };
        const configFilePath = path.join(workfolderPath, CONFIG_FILE_NAME);
        try {
            fs.writeFileSync(configFilePath, YAML.stringify(configFile), 'utf8');
        } catch (e) {
            window.showErrorMessage(CONFIGURATION_UNABLE_TO_CREATE_ERROR_MESSAGE);
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

        if (!fs.existsSync(configFilePath)) {
            return false;
        }
        try {
            configFileString = fs.readFileSync(configFilePath, 'utf8');
        } catch (e) {
            window.showErrorMessage(CONFIGURATION_FILE_UNABLE_TO_READ_ERROR_MESSAGE);
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
            window.showErrorMessage(CONFIGURATION_FILE_NOT_VALID_ERROR_MESSAGE);
            return false;
        }
        if (!validateYAML(configurationFile, CONFIG_FILE_SCHEMA)) {
            window.showErrorMessage(CONFIGURATION_FILE_NOT_VALID_ERROR_MESSAGE);
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
