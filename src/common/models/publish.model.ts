import { WorkfolderPath } from './common.model';
import { WebviewMessage } from './webview.model';

export type PackageId = string;
export type VersionId = string | `${string}@${number}`;
export type FileId = string;

export enum VersionStatus {
    RELEASE = 'release',
    DRAFT = 'draft',
    ARCHIVED = 'archived'
}
export interface BuildConfigFile {
    fileId: FileId;
    publish: boolean;
}
export interface BuildConfig {
    packageId: PackageId;
    version: VersionId;
    status: VersionStatus;
    previousVersion: VersionId;
    files: BuildConfigFile[];
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
    workfolderPath: WorkfolderPath
    packageId: PackageId;
    version: VersionId;
    status: VersionStatus;
    previousVersion: string;
    labels: string;
}

export enum PublishWebviewMessages {
    PUBLISH = 'publish',
    UPDATE_OPTIONS = 'updateOptions',
    UPDATE_FIELD = 'updateField',
    UPDATE_PATTERN = 'updatePattern',
    REQUEST_VERSIONS = 'requestVersions'
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

export interface PublishWebviewPayload {
    field: PublishFields;
    value: string | string[];
}

export interface PublishWebviewDto extends WebviewMessage<PublishWebviewMessages, PublishWebviewPayload | PublishDto | void> {}
