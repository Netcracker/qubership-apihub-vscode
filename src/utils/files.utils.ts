import fs from 'fs';
import JSZip from 'jszip';
import path from 'path';
import { SPECS_EXTENSIONS } from '../common/constants/specification.constants';
import { VersionId } from '../common/models/publish.model';
import { SpecificationItem } from '../common/models/specification-item';
import { WorkfolderPath } from '../common/models/common.model';
import { ConfigurationFile, ConfigurationFileLike } from '../common/models/configuration.model';
import { v4 as uuidv4 } from 'uuid';

export const packToZip = (files: File[]): Promise<Blob> => {
    const zip = new JSZip();
    files.forEach((file) => zip.file(file.name, file.arrayBuffer()));
    return zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
            level: 9
        }
    });
};

export const getName = (path: string): string => {
    if (!path) {
        return 'undefined';
    }
    if (path.includes('\\')) {
        return path.split('\\').pop() ?? '';
    }
    return '';
};

export function getFileDirectory(filePath: string): string {
    return path.dirname(filePath) + path.sep;
}

export function capitalize(str: string): string {
    if (!str) {
        return str;
    }
    return str[0].toUpperCase() + str.slice(1);
}

export function getExtension(fileName: string): string {
    return fileName.split('.').pop() ?? '';
}

export function isApispecFile(extension: string): boolean {
    return SPECS_EXTENSIONS.includes(extension ?? '');
}

export function isItemApispecFile(item: SpecificationItem): boolean {
    return isApispecFile(getExtension(item.uri.fsPath));
}

export function getFilePath(workfolderPath: WorkfolderPath, filePath: string): string {
    return path.posix.normalize(relative(workfolderPath, filePath));
}

function relative(workfolderPath: WorkfolderPath, filePath: string): string {
    return path.relative(workfolderPath, filePath).replace(/\\/g, '/');
}

export function getMiddlePath(workfolderPath: WorkfolderPath, filePath: string): string {
    return `/${path.dirname(relative(workfolderPath, filePath))}/`;
}

export function specificationItemToFile(item: SpecificationItem): File {
    return new File([fs.readFileSync(item.uri.fsPath)], getFilePath(item.workspacePath, item.uri.fsPath));
}

export function splitVersion(version: VersionId): { version: string; revision: string } {
    if (!version) {
        return { revision: '', version: '' };
    }
    const [versionKey, revisionKey] = version.split('@');
    return {
        version: versionKey,
        revision: revisionKey ?? ''
    };
}
export function sortStrings(arr: string[]): string[] {
    return arr.sort((a, b) => a.localeCompare(b));
}

export function isPathExists(path: string): boolean {
    try {
        fs.accessSync(path);
    } catch {
        return false;
    }
    return true;
}

export function convertConfigurationFileToLike(config: ConfigurationFile): ConfigurationFileLike {
    return {
        files: new Set(config.files ?? []),
        pacakgeId: config?.pacakgeId ?? '',
        version: config?.version ?? 1,
        id: uuidv4()
    };
}