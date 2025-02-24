import path from 'path';
import { WorkfolderPath } from '../common/models/common.model';
import { SPECS_EXTENSIONS } from '../common/constants/specification.constants';
import { SpecificationItem } from '../common/models/specification-item';

export function normalize(path: string): string {
    return path.normalize(path);
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

export function getFileDirectory(filePath: string): string {
    return path.dirname(filePath) + path.sep;
}

export const getName = (path: string): string => {
    if (!path) {
        return 'undefined';
    }
    if (path.includes('\\')) {
        return path.split('\\').pop() ?? '';
    }
    return '';
};

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

export function sortStrings(arr: string[]): string[] {
    return arr.sort((a, b) => a.localeCompare(b));
}
