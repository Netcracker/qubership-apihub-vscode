import Ajv, { JSONSchemaType } from 'ajv';
import fs from 'fs';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import { PUBLISH_NO_PREVIOUS_VERSION } from '../common/constants/publish.constants';
import { ConfigurationFile, ConfigurationFileLike } from '../common/models/configuration.model';
import { VersionId } from '../common/models/publish.model';
import { SpecificationItem } from '../common/models/specification-item';
import { getFilePath } from './path.utils';

export const packToZip = async (files: File[]): Promise<Blob> => {
    const zip = new JSZip();
    files.forEach((file) => zip.file(file.name, file.arrayBuffer()));
    return zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
    });
};

export const specificationItemToFile = (item: SpecificationItem): File => {
    const fileContent = fs.readFileSync(item.uri.fsPath);
    const fileName = getFilePath(item.workspacePath, item.uri.fsPath);
    return new File([fileContent], fileName);
};

export const isPathExists = (path: string): boolean => {
    try {
        fs.accessSync(path);
        return true;
    } catch {
        return false;
    }
};

export const convertConfigurationFileToLike = (config: ConfigurationFile): ConfigurationFileLike => {
    return {
        files: new Set(config.files ?? []),
        packageId: config.packageId || '',
        version: config.version || 1,
        id: uuidv4()
    };
};

export const splitVersion = (version: VersionId): { version: string; revision: string } => {
    if (!version) {
        return { version: '', revision: '' };
    }
    const [versionKey, revisionKey] = version.split('@');
    return { version: versionKey, revision: revisionKey || '' };
};

export const convertPreviousVersion = (version: VersionId): string => {
    if (!version || version === PUBLISH_NO_PREVIOUS_VERSION) {
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
        clearTimeout(timer);
        timer = setTimeout(() => func(...args), delay);
    };
}

export const validateYAML = <T>(yamlData: object, schema: JSONSchemaType<T>): boolean => {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    if (!validate(yamlData)) {
        throw new Error(`Validation errors: ${JSON.stringify(validate.errors)}`);
    }
    return true;
};
