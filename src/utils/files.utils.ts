import fs from 'fs';
import JSZip from 'jszip';

import { SPECS_EXTENSIONS } from '../common/constants/specification.constants';
import { VersionId } from '../common/models/publish.model';
import { SpecificationItem } from '../common/models/specification-item';
import { WorkfolderPath } from '../common/models/common.model';
import { ConfigurationFile, ConfigurationFileLike } from '../common/models/configuration.model';
import { v4 as uuidv4 } from 'uuid';
import { getFilePath } from './path.utils';

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

export function specificationItemToFile(item: SpecificationItem): File {
    return new File([fs.readFileSync(item.uri.fsPath)], getFilePath(item.workspacePath, item.uri.fsPath));
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

export function debounce<T extends (...args: any[]) => void>(
    func: T,
    delay: number = 1000
): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => func(...args), delay);
    };
}
