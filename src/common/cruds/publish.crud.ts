import { BodyInit } from 'undici-types';
import { Disposable } from 'vscode';
import { API_V2, API_V3 } from '../constants/common.constants';
import {
    PackageId,
    PublishConfig,
    PublishStatusDto,
    PublishVersionDto,
    PublishViewPackageIdData,
    VersionId,
    VersionStatus
} from '../models/publish.model';

const enum CrudMethod {
    GET = 'GET',
    POST = 'POST'
}
const PAT_HEADER = 'X-Personal-Access-Token';

const enum RequestNames {
    GET_VERSIONS,
    GET_PACKAGE_ID,
    GET_LABELS,
    GET_STATUS,
    PUBLISH
}

export class CrudService extends Disposable {
    private readonly abortControllers: Map<RequestNames, AbortController> = new Map();
    private readonly VERSION_SERACH_PARAMS = new URLSearchParams({
        status: VersionStatus.RELEASE,
        limit: '100',
        page: '0'
    }).toString();

    constructor() {
        super(() => this.dispose());
    }

    public dispose() {
        this.abortControllers.forEach((controller) => controller.abort());
    }

    public getVersions(baseUrl: string, authorization: string, packageId: PackageId): Promise<PublishVersionDto> {
        const url = new URL(`${baseUrl}${API_V3}/packages/${packageId}/versions`);
        url.search = this.VERSION_SERACH_PARAMS;
        return this.get(RequestNames.GET_VERSIONS, url, authorization);
    }

    public getPackageId(
        baseUrl: string,
        authorization: string,
        packageId: PackageId
    ): Promise<PublishViewPackageIdData> {
        return this.get(RequestNames.GET_PACKAGE_ID, `${baseUrl}${API_V2}/packages/${packageId}`, authorization);
    }

    public getLabels(
        baseUrl: string,
        authorization: string,
        packageId: PackageId,
        version: VersionId
    ): Promise<PublishVersionDto> {
        const url = new URL(`${baseUrl}${API_V3}/packages/${packageId}/versions`);
        url.search = new URLSearchParams({
            textFilter: version
        }).toString();
        return this.get(RequestNames.GET_LABELS, url, authorization);
    }

    public getStatus(
        baseUrl: string,
        authorization: string,
        packageId: PackageId,
        publishId: string
    ): Promise<PublishStatusDto> {
        return this.get(
            RequestNames.GET_STATUS,
            `${baseUrl}${API_V2}/packages/${packageId}/publish/${publishId}/status`,
            authorization
        );
    }

    public publishApispec(
        baseUrl: string,
        packageId: PackageId,
        authorization: string,
        formData: Blob | FormData
    ): Promise<PublishConfig> {
        return this.post(
            RequestNames.PUBLISH,
            `${baseUrl}${API_V2}/packages/${packageId}/publish`,
            formData,
            authorization
        );
    }

    private post<T>(
        name: RequestNames,
        url: string | URL,
        body: BodyInit | undefined,
        authorization: string
    ): Promise<T> {
        return this.send(name, url, CrudMethod.POST, authorization, body);
    }

    private get<T>(name: RequestNames, url: string | URL, authorization: string): Promise<T> {
        return this.send(name, url, CrudMethod.GET, authorization);
    }

    private async send<T>(
        requestName: RequestNames,
        url: string | URL,
        method: CrudMethod,
        authorization: string,
        body?: BodyInit | undefined
    ): Promise<T> {
        const controller = new AbortController();
        this.deleteController(requestName);
        this.addController(requestName, controller);
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    [PAT_HEADER]: authorization
                },
                ...(method === CrudMethod.POST && { body }),
                signal: controller.signal
            });
            
            if (!response.ok) {
                throw new Error(response.statusText);
            }

            return (await response.json()) as T;
        } finally {
            this.deleteController(requestName);
        }
    }

    private addController(requestName: RequestNames, controller: AbortController): void {
        this.abortControllers.set(requestName, controller);
    }
    private deleteController(requestName: RequestNames): void {
        this.abortControllers.get(requestName)?.abort();
        this.abortControllers.delete(requestName);
    }
}
