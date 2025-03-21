import { BodyInit } from 'undici-types';
import { Disposable } from 'vscode';
import { API_V1, API_V2, API_V3, PACKAGES } from '../constants/common.constants';
import {
    PackageId,
    PublishConfig,
    PublishStatusDto,
    PublishVersionDto,
    PublishViewPackageIdData,
    VersionId,
    VersionStatus
} from '../models/publish.model';
import { CrudError, CrudResponse, DefaultError, ServerStatusDto } from '../models/common.model';

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
    GET_SYSTEM_INFO,
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

    public getSystemInfo(baseUrl: string, authorization: string): Promise<ServerStatusDto> {
        return this.get(RequestNames.GET_SYSTEM_INFO, `${baseUrl}${API_V1}/system/info`, authorization);
    }

    public getVersions(baseUrl: string, authorization: string, packageId: PackageId): Promise<PublishVersionDto> {
        const url = new URL(`${baseUrl}${API_V3}/${PACKAGES}/${packageId}/versions`);
        url.search = this.VERSION_SERACH_PARAMS;
        return this.get(RequestNames.GET_VERSIONS, url, authorization);
    }

    public getPackageId(
        baseUrl: string,
        authorization: string,
        packageId: PackageId
    ): Promise<PublishViewPackageIdData> {
        return this.get(RequestNames.GET_PACKAGE_ID, `${baseUrl}${API_V2}/${PACKAGES}/${packageId}`, authorization);
    }

    public getLabels(
        baseUrl: string,
        authorization: string,
        packageId: PackageId,
        version: VersionId
    ): Promise<PublishVersionDto> {
        const url = new URL(`${baseUrl}${API_V3}/${PACKAGES}/${packageId}/versions`);
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
            `${baseUrl}${API_V2}/${PACKAGES}/${packageId}/publish/${publishId}/status`,
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
            `${baseUrl}${API_V2}/${PACKAGES}/${packageId}/publish`,
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
                const errorData = await this.getErrorData(response);
                throw new CrudError(
                    errorData?.message || response?.statusText,
                    errorData?.code ?? '',
                    errorData?.debug ?? '',
                    errorData?.status || response?.status
                );
            }

            return (await response.json()) as T;
        } catch (error) {
            if (error instanceof CrudError) {
                throw error;
            }
            const defaultError = error as DefaultError;
            throw new CrudError(
                defaultError.message,
                defaultError?.code || defaultError.cause?.code || '',
                defaultError.stack
            );
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

    private async getErrorData(response: Response): Promise<CrudResponse> {
        try {
            return (await response.json()) as CrudResponse;
        } catch {}
        return {};
    }
}
