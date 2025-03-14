import * as http from 'http';
import { API_V1, PAT_HEADER } from '../../common/constants/common.constants';
import { ServerStatusDto } from '../../common/models/common.model';
import { LOCAL_SERVER_PORT, TEST_PAT_TOKEN } from '../test.constants';

export class LocalServer {
    private readonly server: http.Server;
    private readonly port: number;
    private readonly routes: Map<string, (req: http.IncomingMessage, res: http.ServerResponse) => void>;

    constructor() {
        this.port = LOCAL_SERVER_PORT;
        this.routes = new Map();
        this.server = http.createServer(this.requestHandler.bind(this));

        this.register();
    }

    public registerRoute(path: string, handler: (req: http.IncomingMessage, res: http.ServerResponse) => void): void {
        this.routes.set(path, handler);
    }

    private register(): void {
        this.registerRoute(`${API_V1}/system/info`, (req: http.IncomingMessage, res: http.ServerResponse) => {
            if (req.method !== 'GET') {
                this.sendResponseWithDelay(res, 404, 'Not Found');
                return;
            }

            if (req.headers[PAT_HEADER.toLocaleLowerCase()] !== TEST_PAT_TOKEN) {
                this.sendResponseWithDelay(res, 401, 'Not Found');
                return;
            }
            this.sendResponseWithDelay(
                res,
                200,
                JSON.stringify({
                    backendVersion: '',
                    externalLinks: [],
                    frontendVersion: '',
                    productionMode: false
                } as ServerStatusDto)
            );
        });
    }

    private requestHandler(req: http.IncomingMessage, res: http.ServerResponse): void {
        if (req.url && this.routes.has(req.url)) {
            this.routes.get(req.url)?.(req, res);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    }

    private sendResponseWithDelay(res: http.ServerResponse, statusCode: number, body: any): void {
        setTimeout(() => {
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(body);
        }, 100);
    }

    public start(): void {
        this.server.listen(this.port, () => {
            console.log(`Local server running`);
        });
    }

    public stop(): void {
        this.server.close(() => {
            console.log('Server closed');
        });
    }
}
