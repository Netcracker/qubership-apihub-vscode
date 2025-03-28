import express from 'express';
import { AddressInfo } from 'net';
import { API_V1, API_V2, API_V3, PACKAGES, PAT_HEADER } from '../../common/constants/common.constants';
import { PublishVersionDto, PublishViewPackageIdData } from '../../common/models/publish.model';
import { LOCAL_SERVER_PORT, TEST_BROKEN_PAT_TOKEN, TEST_LOADING_PAT_TOKEN } from '../constants/environment.constants';
import { PACKAGE_ID_NAME, PACKAGES_DATA } from './data/packages';
import { SERVER_STATUS_DTO } from './data/status';
import { VERSIONS } from './data/versions';

export class LocalServer {
    private readonly _app = express();
    private _server: ReturnType<typeof this._app.listen> | null = null;

    constructor(private port: number = LOCAL_SERVER_PORT) {
        this.setupRoutes();
    }

    private setupRoutes(): void {
        this._app.use(express.json());

        this._app.get(`${API_V1}/system/info`, (req, res) => {
            const token: string | undefined = req.get(PAT_HEADER.toLocaleLowerCase());

            if (token === TEST_LOADING_PAT_TOKEN) {
                setTimeout(() => res.status(200).json(SERVER_STATUS_DTO), 1000);
                return;
            }

            if (token === TEST_BROKEN_PAT_TOKEN) {
                res.status(401).json();
                return;
            }

            setTimeout(() => res.status(200).json(SERVER_STATUS_DTO), token === TEST_LOADING_PAT_TOKEN ? 1000 : 100);
        });

        this._app.get(`${API_V3}/${PACKAGES}/:packageId/versions`, (req, res) => {
            const packageId = req.params.packageId;
            res.status(200).json(packageId === PACKAGE_ID_NAME ? ({ versions: VERSIONS } as PublishVersionDto) : []);
        });

        this._app.get(`${API_V2}/${PACKAGES}/:packageId`, (req, res) => {
            const packageId = req.params.packageId;
            const packageIdData: PublishViewPackageIdData | undefined = PACKAGES_DATA.find(
                (data) => data.packageId === packageId
            );
            if (packageIdData) {
                res.status(200).json(packageIdData as PublishViewPackageIdData);
                return;
            }
            res.status(404).json();
        });
    }

    public start(): Promise<number> {
        return new Promise((resolve, reject) => {
            this._server = this._app
                .listen(this.port, () => {
                    const address = this._server?.address() as AddressInfo;
                    resolve(address.port);
                })
                .on('error', (err) => {
                    reject(err);
                });
        });
    }

    public stop(): void {
        if (this._server) {
            this._server.close();
        }
    }
}
