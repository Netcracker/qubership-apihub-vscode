import { WorkfolderPath } from './common.model';
import { WebviewMessage, WebviewMessages, WebviewPayload } from './webview.model';
import { BackwardCompatibilityFields, BWC_DEFAULT_BASELINE_REFERENCE } from '../constants/backward-compatibility.constants';

export interface BackwardCompatibilityWebviewDto
    extends WebviewMessage<WebviewMessages, WebviewPayload<BackwardCompatibilityFields>> {}

export class BackwardCompatibilityViewData {
    public runCheck: boolean;
    public baselineReference: string;
    public excludeComponentsScope: boolean;

    constructor() {
        this.runCheck = false;
        this.baselineReference = BWC_DEFAULT_BASELINE_REFERENCE;
        this.excludeComponentsScope = true;
    }
}

export type BackwardCompatibilityState = {
    workfolderPath: WorkfolderPath;
    enabled: boolean;
    baselineReference: string;
};

