import Ajv, { JSONSchemaType } from 'ajv';
import fs from 'fs';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import { PUBLISH_NO_PREVIOUS_VERSION } from '../common/constants/publish.constants';
import { ConfigurationFile, ConfigurationFileLike } from '../common/models/configuration.model';
import { VersionId } from '../common/models/publish.model';
import { SpecificationItem } from '../common/models/specification-item';
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

export const specificationItemToFile = (item: SpecificationItem): File => {
    return new File([fs.readFileSync(item.uri.fsPath)], getFilePath(item.workspacePath, item.uri.fsPath));
};

export const isPathExists = (path: string): boolean => {
    try {
        fs.accessSync(path);
    } catch {
        return false;
    }
    return true;
};

export const convertConfigurationFileToLike = (config: ConfigurationFile): ConfigurationFileLike => {
    return {
        files: new Set(config.files ?? []),
        packageId: config?.packageId ?? '',
        version: config?.version ?? 1,
        id: uuidv4()
    };
};

export const splitVersion = (version: VersionId): { version: string; revision: string } => {
    if (!version) {
        return { revision: '', version: '' };
    }
    const [versionKey, revisionKey] = version.split('@');
    return {
        version: versionKey,
        revision: revisionKey ?? ''
    };
};

export const convertPreviousVersion = (version: VersionId): string => {
    if (version === PUBLISH_NO_PREVIOUS_VERSION) {
        return '';
    }
    return splitVersion(version).version;
};

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

export const validateYAML = <T>(yamlData: Object, schema: JSONSchemaType<T>): boolean => {
    const ajv = new Ajv();
    try {
        const validate = ajv.compile(schema);
        const valid = validate(yamlData);

        return valid;
    } catch (error) {
        throw new Error('Errors: ' + String(error));
    }
};
