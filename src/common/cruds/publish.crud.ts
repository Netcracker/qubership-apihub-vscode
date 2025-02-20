import { BodyInit } from 'undici-types';
import { API_V2, API_V3 } from '../constants/common.constants';
import {
    BuildConfig,
    BuildConfigFile,
    PackageId,
    PublishConfig,
    PublishStatusDto,
    PublishVersionDto,
    VersionId,
    VersionStatus
} from '../models/publish.model';

const enum CrudMethod {
    GET = 'GET',
    POST = 'POST'
}
const CRUD_TIMEOUT = 10000;

export class CrudService {
    private readonly VERSION_SERACH_PARAMS = new URLSearchParams({
        status: VersionStatus.RELEASE,
        limit: '100',
        page: '0'
    }).toString();

    public getVersions(baseUrl: string, packageId: PackageId, authorization: string): Promise<PublishVersionDto> {
        const url = new URL(`${baseUrl}${API_V3}/packages/${packageId}/versions`);
        url.search = this.VERSION_SERACH_PARAMS;
        return this.sendGet(url, authorization);
    }

    public getStatus(
        baseUrl: string,
        packageId: PackageId,
        publishId: string,
        authorization: string
    ): Promise<PublishStatusDto> {
        return this.sendGet(`${baseUrl}${API_V2}/packages/${packageId}/publish/${publishId}/status`, authorization);
    }

    public publishApispec(
        baseUrl: string,
        buildConfigFile: BuildConfigFile[],
        data: Blob,
        packageId: string,
        status: VersionStatus,
        version: VersionId,
        previousVersion: VersionId,
        authorization: string
    ): Promise<PublishConfig> {
        const config: BuildConfig = {
            packageId,
            status,
            version,
            previousVersion,
            files: buildConfigFile
        };
        const formData = new FormData();

        data && formData.append('sources', data, 'package.zip');

        const publishConfig = {
            ...config,
            sources: undefined
        };

        formData.append('config', JSON.stringify(publishConfig));

        return this.sendPost(`${baseUrl}${API_V2}/packages/${packageId}/publish`, formData, authorization);
    }

    private sendPost<T>(url: string | URL, body: BodyInit | undefined, authorization: string): Promise<T> {
        return this.send(url, CrudMethod.POST, authorization, body);
    }

    private sendGet<T>(url: string | URL, authorization: string): Promise<T> {
        return this.send(url, CrudMethod.GET, authorization);
    }

    private async send<T>(
        url: string | URL,
        method: CrudMethod,
        authorization: string,
        body?: BodyInit | undefined
    ): Promise<T> {
        const response = await fetch(url, {
            method,
            headers: {
                authorization
            },
            ...(method === CrudMethod.POST && { body }),
            signal: AbortSignal.timeout(CRUD_TIMEOUT)
        });
        if (!response.ok) {
            throw new Error(response.statusText);
        }

        return (await response.json()) as T;
    }
}
