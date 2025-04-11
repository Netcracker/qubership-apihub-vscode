import { BodyInit } from 'undici-types';
import { Disposable } from 'vscode';
import { API_V1, API_V2, API_V3, PACKAGES, PAT_HEADER } from '../constants/common.constants';
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

export const enum RequestNames {
    GET_VERSIONS,
    GET_PACKAGE_ID,
    GET_LABELS,
    GET_STATUS,
    GET_SYSTEM_INFO,
    PUBLISH
}

export class CrudService extends Disposable {
    private readonly abortControllers: Map<RequestNames, AbortController> = new Map();
    private readonly VERSION_SEARCH_PARAMS = new URLSearchParams({
        status: VersionStatus.RELEASE,
        limit: '100',
        page: '0'
    }).toString();

    constructor() {
        super(() => this.dispose());
    }

    public abort(requestName: RequestNames): void {
        this.abortControllers.get(requestName)?.abort();
    }

    public dispose(): void {
        this.abortControllers.forEach((controller) => controller.abort());
        this.abortControllers.clear();
    }

    public getSystemInfo(baseUrl: string, authorization: string): Promise<ServerStatusDto> {
        return this.get(RequestNames.GET_SYSTEM_INFO, this.buildUrl(baseUrl, API_V1, 'system/info'), authorization);
    }

    public getVersions(baseUrl: string, authorization: string, packageId: PackageId): Promise<PublishVersionDto> {
        const url = this.buildUrl(baseUrl, API_V3, `${PACKAGES}/${packageId}/versions`, this.VERSION_SEARCH_PARAMS);
        return this.get(RequestNames.GET_VERSIONS, url, authorization);
    }

    public getPackageId(
        baseUrl: string,
        authorization: string,
        packageId: PackageId
    ): Promise<PublishViewPackageIdData> {
        return this.get(RequestNames.GET_PACKAGE_ID, this.buildUrl(baseUrl, API_V2, `${PACKAGES}/${packageId}`), authorization);
    }

    public getLabels(
        baseUrl: string,
        authorization: string,
        packageId: PackageId,
        version: VersionId
    ): Promise<PublishVersionDto> {
        const url = this.buildUrl(baseUrl, API_V3, `${PACKAGES}/${packageId}/versions`, `textFilter=${version}`);
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
            this.buildUrl(baseUrl, API_V2, `${PACKAGES}/${packageId}/publish/${publishId}/status`),
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
            this.buildUrl(baseUrl, API_V2, `${PACKAGES}/${packageId}/publish`),
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
        body?: BodyInit
    ): Promise<T> {
        this.abort(requestName);
        const controller = new AbortController();
        this.abortControllers.set(requestName, controller);

        try {
            const response = await fetch(url, {
                method,
                headers: { [PAT_HEADER]: authorization },
                ...(method === CrudMethod.POST && { body }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await this.getErrorData(response);
                throw new CrudError(
                    errorData?.message || response.statusText,
                    errorData?.code ?? '',
                    errorData?.debug ?? '',
                    errorData?.status || response.status
                );
            }

            return (await response.json()) as T;
        } catch (error) {
            this.handleError(error);
        } finally {
            this.abortControllers.delete(requestName);
        }
    }

    private async getErrorData(response: Response): Promise<CrudResponse> {
        try {
            return (await response.json()) as CrudResponse;
        } catch {
            return {};
        }
    }

    private buildUrl(baseUrl: string, apiVersion: string, path: string, searchParams?: string): string {
        const url = new URL(`${baseUrl}${apiVersion}/${path}`);
        if (searchParams) {
            url.search = searchParams;
        }
        return url.toString();
    }

    private handleError(error: unknown): never {
        if (error instanceof CrudError) {
            throw error;
        }
        const defaultError = error as DefaultError;
        throw new CrudError(defaultError.message, '', defaultError.stack, defaultError?.code);
    }
}
