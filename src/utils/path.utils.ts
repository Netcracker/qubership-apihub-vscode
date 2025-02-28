import path from 'path';
import { SPECS_EXTENSIONS } from '../common/constants/specification.constants';
import { WorkfolderPath } from '../common/models/common.model';
import { SpecificationItem } from '../common/models/specification-item';

export const normalize = (path: string): string => {
    return path.normalize(path);
};

export const join = (path1: string, path2: string): string => {
    return path.join(path1, path2);
};

export const getFilePath = (workfolderPath: WorkfolderPath, filePath: string): string => {
    return path.posix.normalize(relative(workfolderPath, filePath));
};

const relative = (workfolderPath: WorkfolderPath, filePath: string): string => {
    return path.relative(workfolderPath, filePath).replace(/\\/g, '/');
};

export const getMiddlePath = (workfolderPath: WorkfolderPath, filePath: string): string => {
    return `/${path.dirname(relative(workfolderPath, filePath))}/`;
};

export const getFileDirectory = (filePath: string): string => {
    return path.dirname(filePath) + path.sep;
};

export const capitalize = (str: string): string => {
    if (!str) {
        return str;
    }
    return str[0].toUpperCase() + str.slice(1);
};

export const getExtension = (fileName: string): string => {
    return fileName.split('.').pop() ?? '';
};

export const isApispecFile = (extension: string): boolean => {
    return SPECS_EXTENSIONS.includes(extension ?? '');
};

export const isItemApispecFile = (item: SpecificationItem): boolean => {
    return isApispecFile(getExtension(item.uri.fsPath));
};

export const sortStrings = (arr: string[]): string[] => {
    return arr.sort((a, b) => a.localeCompare(b));
};
