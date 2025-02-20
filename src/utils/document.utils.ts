import { bundle, BundleContext, Resolver } from 'api-ref-bundler';
import { promises as fs } from 'fs';
import path from 'path';
import YAML from 'yaml';
import { BundleData } from '../common/models/bundle.model';
import { BuildConfigFile } from '../common/models/publish.model';
import { SpecificationItem } from '../common/models/specification-item';
import { getFileDirectory, getFilePath } from './files.utils';

export const bundledFileDataWithDependencies = async (
    item: SpecificationItem,
    onError: (message: string, ctx?: BundleContext) => void
): Promise<BundleData> => {
    const files: File[] = [];
    const dependencies: string[] = [];
    const errorMessages: string[] = [];

    const rootApispecPath = item.uri.fsPath;
    const rootApispecName = getFilePath(item.workspacePath, rootApispecPath);
    const rootApicpecDirectory = getFileDirectory(rootApispecPath);

    const resolver: Resolver = async (sourcePath: string) => {
        let normalizePath = sourcePath;

        if (sourcePath !== rootApispecPath) {
            normalizePath = path.join(rootApicpecDirectory, sourcePath);
            dependencies.push(normalizePath);
        }

        const apispecName = getFilePath(item.workspacePath, normalizePath);
        try {
            const apispecData = await fs.readFile(normalizePath, 'utf8');
            const apispecFile = new File([apispecData], apispecName);
            files.push(apispecFile);
            return YAML.parse(apispecData) as object;
        } catch (error) {
            errorMessages.push(String(error));
            return {};
        }
    };

    const bundledFileData = await bundle(rootApispecPath, resolver, { hooks: { onError } });
    const data = bundledFileData && Object.keys(bundledFileData).length ? bundledFileData : undefined;

    if (!data && errorMessages.length) {
        onError(errorMessages.join('\n'));
    }

    return { fileName: rootApispecName, filePath: rootApispecPath, data, dependencies, files };
};

export const createBuildConfigFiles = (publishFileNames: string[], allFileNames: string[]): BuildConfigFile[] => {
    if (!publishFileNames || !publishFileNames.length) {
        return [];
    }
    return allFileNames.map((fileName) => ({ fileId: fileName, publish: publishFileNames.includes(fileName) }));
};

export const convertBundleDataToFiles = (datas: BundleData[]): File[] => {
    const fileMap = new Map<string, File>();
    datas.flatMap((data) => data.files).forEach((file) => fileMap.set(file.name, file));
    return Array.from(fileMap.values());
};
