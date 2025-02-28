import { PUBLISH_INPUT_RELEASE_PATTERN } from '../constants/publish.constants';
import { WorkfolderPath } from './common.model';
import { ConfigurationId } from './configuration.model';
import { WebviewMessage, WebviewMessages, WebviewPayload } from './webview.model';

export type PackageId = string;
export type VersionId = string | `${string}@${number}`;
export type FileId = string;
export type PublishWebviewValueType = string | string[];

export enum VersionStatus {
    RELEASE = 'release',
    DRAFT = 'draft',
    ARCHIVED = 'archived'
}
export interface BuildConfigFile {
    fileId: FileId;
    publish: boolean;
}
export interface BuildConfigMetadata {
    versionLabels: string[];
}

export interface BuildConfig {
    packageId: PackageId;
    version: VersionId;
    status: VersionStatus;
    previousVersion: VersionId;
    files: BuildConfigFile[];
    metadata: BuildConfigMetadata | {};
}

export type Key = Readonly<string>;
export type PublishConfig = { publishId: Key; config: BuildConfig };

export type PublishStatusDto = {
    publishId: string;
    status: PublishStatus;
    message: string;
};

export enum PublishStatus {
    NONE = 'none',
    RUNNING = 'running',
    COMPLETE = 'complete',
    ERROR = 'error'
}

export interface PublishDto {
    packageId: PackageId;
    version: VersionId;
    status: VersionStatus;
    previousVersion: string;
    labels: string[];
}

export interface PublishCommandData {
    workfolderPath: WorkfolderPath;
    data: PublishDto;
}

export enum PublishWebviewMessages {
    PUBLISH = 'publish'
}

export enum PublishFields {
    PACKAGE_ID = 'packageId',
    VERSION = 'version',
    STATUS = 'status',
    PREVIOUS_VERSION = 'previousVersion',
    LABELS = 'labels',
    PUBLISH_BUTTON = 'publish-button'
}

export interface PublishVersionCreatedBy {
    avatarUrl: string;
    email: string;
    id: string;
    name: string;
    type: string;
}
export interface PublishVersion {
    version: string;
    status: string;
    createdAt: string;
    createdBy: PublishVersionCreatedBy;
    versionLabels: string[];
    previousVersion: string;
}
export interface PublishVersionDto {
    versions: PublishVersion[];
}

export interface PublishWebviewDto
    extends WebviewMessage<WebviewMessages | PublishWebviewMessages, WebviewPayload<PublishFields> | PublishDto | void> {}

export class PublishViewData {
    public packageId: PackageId;
    public version: VersionId;
    public labels: Set<string>;
    public status: VersionStatus;
    public previousVersion: VersionId;
    public configId: ConfigurationId;
    public releaseVersionPattern: string;

    constructor() {
        this.packageId = '';
        this.version = '';
        this.labels = new Set();
        this.status = VersionStatus.DRAFT;
        this.previousVersion = '';
        this.configId = '';
        this.releaseVersionPattern = PUBLISH_INPUT_RELEASE_PATTERN;
    }
}

export interface PublishViewPackageIdData{
    packageId: PackageId,
    alias: string,
    parentId: string,
    kind: string,
    name: string,
    description: string,
    isFavorite: boolean,
    imageUrl: string,
    parents: string[],
    defaultRole: string,
    permissions: string[],
    defaultReleaseVersion: string,
    defaultVersion: string,
    releaseVersionPattern: string,
    excludeFromSearch: boolean
}
