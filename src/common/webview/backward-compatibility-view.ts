import {
    CancellationToken,
    Disposable,
    ExtensionContext,
    Webview,
    WebviewView,
    WebviewViewResolveContext,
    workspace
} from 'vscode';
import { debounce } from '../../utils/common.utils';
import { getCodicon, getElements, getJsScript, getNonce, getStyle } from '../../utils/html-content.builder';
import {
    BackwardCompatibilityFields,
    BWC_DEFAULT_BASELINE_REFERENCE,
    BWC_GIT_VALIDATION_DEBOUNCE,
    BWC_JS_PATH,
    BWC_WEBVIEW
} from '../constants/backward-compatibility.constants';
import { MAIN_JS_PATH } from '../constants/common.constants';
import { WorkfolderPath } from '../models/common.model';
import {
    BackwardCompatibilityViewData,
    BackwardCompatibilityWebviewDto
} from '../models/backward-compatibility.model';
import { WebviewMessages, WebviewPayload } from '../models/webview.model';
import { BackwardCompatibilityService } from '../services/backward-compatibility.service';
import { ItemCheckboxService } from '../services/Item-checkbox.service';
import { WorkspaceService } from '../services/workspace.service';
import { WebviewBase } from './webview-base';

export class BackwardCompatibilityViewProvider extends WebviewBase<BackwardCompatibilityFields> {
    private readonly _viewData: Map<WorkfolderPath, BackwardCompatibilityViewData> = new Map();
    private readonly validateGitReferenceDebounced = debounce(
        (workfolderPath: WorkfolderPath, reference: string) => this.validateGitReference(workfolderPath, reference),
        BWC_GIT_VALIDATION_DEBOUNCE
    );

    constructor(
        private readonly context: ExtensionContext,
        private readonly workspaceService: WorkspaceService,
        private readonly itemCheckboxService: ItemCheckboxService,
        private readonly bwcService: BackwardCompatibilityService
    ) {
        super(() => this.dispose());
    }

    public resolveWebviewView(
        webviewView: WebviewView,
        _context: WebviewViewResolveContext,
        _token: CancellationToken
    ): Thenable<void> | void {
        this._view = webviewView;
        this.initializeWebview(webviewView);
        this.activate(true);
    }

    public dispose(): void {
        super.dispose();
        this.workspaceService.unsubscribe(BWC_WEBVIEW);
    }

    private initializeWebview(webviewView: WebviewView): void {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        webviewView.onDidChangeVisibility(() => {
            this.activate(this._view?.visible ?? false);
        });
    }

    private activate(active: boolean): void {
        if (!active) {
            this.dispose();
            return;
        }
        this.subscribeChanges();
        this.restoreFields(this.workspaceService.activeWorkfolderPath);
    }

    private subscribeChanges(): void {
        if (!this._view) {
            return;
        }

        this._view.webview.onDidReceiveMessage(this.handleWebviewMessage.bind(this), this, this._disposables);

        this.workspaceService.subscribe(BWC_WEBVIEW, (workfolderPath) => this.restoreFields(workfolderPath));

        // Subscribe to checkbox changes (document selection)
        this.itemCheckboxService.onDidChangeCheckboxes(
            (event) => {
                if (event.workspace === this.workspaceService.activeWorkfolderPath) {
                    const viewData = this.getViewData(event.workspace);
                    if (event.checked && viewData.runCheck) {
                        // Document was checked - run check for it
                        this.runCheckForFiles([event.filePath], event.workspace);
                    } else {
                        // Document was unchecked - clear diagnostics for it
                        this.bwcService.clearDiagnosticsForFile(event.filePath);
                    }
                }
            },
            this,
            this._disposables
        );

        // Subscribe to document save events
        workspace.onDidSaveTextDocument(
            (document) => {
                const workfolderPath = this.workspaceService.activeWorkfolderPath;
                const viewData = this.getViewData(workfolderPath);

                if (viewData.runCheck) {
                    const filePath = document.uri.fsPath;
                    const selectedFiles = this.itemCheckboxService.getValues(workfolderPath);

                    // Check if this file is in the selected documents
                    if (selectedFiles.includes(filePath)) {
                        this.runCheckForFiles([filePath], workfolderPath);
                    }
                }
            },
            this,
            this._disposables
        );
    }

    private handleWebviewMessage(message: BackwardCompatibilityWebviewDto): void {
        switch (message.command) {
            case WebviewMessages.UPDATE_FIELD:
                this.updateField(message.payload as WebviewPayload<BackwardCompatibilityFields>);
                break;
            case WebviewMessages.REQUEST_FIELD:
                this.requestField(message.payload as WebviewPayload<BackwardCompatibilityFields>);
                break;
        }
    }

    private async updateField(payload: WebviewPayload<BackwardCompatibilityFields>): Promise<void> {
        const workfolderPath = this.workspaceService.activeWorkfolderPath;
        const viewData = this.getViewData(workfolderPath);

        switch (payload.field) {
            case BackwardCompatibilityFields.RUN_CHECK: {
                const checked = payload.value === 'true' || (typeof payload.value === 'boolean' && payload.value);
                viewData.runCheck = checked;

                if (checked) {
                    // Enable baseline reference input and exclude checkbox
                    this.updateWebviewDisable(BackwardCompatibilityFields.BASELINE_REFERENCE, false);
                    this.updateWebviewDisable(BackwardCompatibilityFields.EXCLUDE_COMPONENTS_SCOPE, false);
                    // Run check for all selected documents
                    this.runCheckForSelectedDocuments(workfolderPath);
                } else {
                    // Disable baseline reference input and exclude checkbox
                    this.updateWebviewDisable(BackwardCompatibilityFields.BASELINE_REFERENCE, true);
                    this.updateWebviewDisable(BackwardCompatibilityFields.EXCLUDE_COMPONENTS_SCOPE, true);
                    // Clear all diagnostics
                    this.bwcService.clearDiagnostics();
                }
                break;
            }
            case BackwardCompatibilityFields.BASELINE_REFERENCE: {
                const reference = payload.value as string;
                viewData.baselineReference = reference;

                // Validate git reference with debounce (clears invalid state when valid)
                this.validateGitReferenceDebounced(workfolderPath, reference);

                break;
            }
            case BackwardCompatibilityFields.EXCLUDE_COMPONENTS_SCOPE: {
                const checked = payload.value === 'true' || (typeof payload.value === 'boolean' && payload.value);
                viewData.excludeComponentsScope = checked;

                // Reapply filtering using cached diffs
                await this.bwcService.reapplyFilteringForCachedDiffs(checked);
                break;
            }
        }
    }

    private requestField(payload: WebviewPayload<BackwardCompatibilityFields>): void {
        const workfolderPath = this.workspaceService.activeWorkfolderPath;
        const viewData = this.getViewData(workfolderPath);

        switch (payload.field) {
            case BackwardCompatibilityFields.RUN_CHECK:
                this.updateWebviewField(BackwardCompatibilityFields.RUN_CHECK, viewData.runCheck.toString());
                break;
            case BackwardCompatibilityFields.BASELINE_REFERENCE:
                this.updateWebviewField(BackwardCompatibilityFields.BASELINE_REFERENCE, viewData.baselineReference);
                break;
            case BackwardCompatibilityFields.EXCLUDE_COMPONENTS_SCOPE:
                this.updateWebviewField(BackwardCompatibilityFields.EXCLUDE_COMPONENTS_SCOPE, viewData.excludeComponentsScope.toString());
                break;
        }
    }

    private restoreFields(workfolderPath: WorkfolderPath): void {
        const viewData = this.getViewData(workfolderPath);

        this.updateWebviewField(BackwardCompatibilityFields.RUN_CHECK, viewData.runCheck.toString());
        this.updateWebviewField(BackwardCompatibilityFields.BASELINE_REFERENCE, viewData.baselineReference);
        this.updateWebviewField(BackwardCompatibilityFields.EXCLUDE_COMPONENTS_SCOPE, viewData.excludeComponentsScope.toString());
        this.updateWebviewDisable(BackwardCompatibilityFields.BASELINE_REFERENCE, !viewData.runCheck);
        this.updateWebviewDisable(BackwardCompatibilityFields.EXCLUDE_COMPONENTS_SCOPE, !viewData.runCheck);
    }

    private async validateGitReference(workfolderPath: WorkfolderPath, reference: string): Promise<void> {
        const isValid = await this.bwcService.validateGitReference(reference, workfolderPath);
        this.updateWebviewInvalid(BackwardCompatibilityFields.BASELINE_REFERENCE, !isValid);

        // If validation passed and check is enabled, re-run check with new reference
        const viewData = this.getViewData(workfolderPath);
        if (isValid && viewData.runCheck) {
            this.runCheckForSelectedDocuments(workfolderPath);
        }
    }

    private async runCheckForSelectedDocuments(workfolderPath: WorkfolderPath): Promise<void> {
        const selectedFiles = this.itemCheckboxService.getValues(workfolderPath);
        await this.runCheckForFiles(selectedFiles, workfolderPath);
    }

    private async runCheckForFiles(filePaths: string[], workfolderPath: WorkfolderPath): Promise<void> {
        const viewData = this.getViewData(workfolderPath);

        if (!viewData.runCheck || filePaths.length === 0) {
            return;
        }

        // Validate reference before running check
        const isValid = await this.bwcService.validateGitReference(viewData.baselineReference, workfolderPath);
        if (!isValid) {
            this.updateWebviewInvalid(BackwardCompatibilityFields.BASELINE_REFERENCE, true);
            return;
        }

        // Clear invalid state if validation passed
        this.updateWebviewInvalid(BackwardCompatibilityFields.BASELINE_REFERENCE, false);

        // Show spinner
        this.showSpinner(true);

        try {
            await this.bwcService.runBackwardCompatibilityCheck(
                filePaths,
                viewData.baselineReference,
                workfolderPath,
                viewData.excludeComponentsScope
            );
        } finally {
            // Hide spinner
            this.showSpinner(false);
        }
    }

    private showSpinner(show: boolean): void {
        this._view?.webview.postMessage({
            command: 'showSpinner',
            payload: {
                show
            }
        });
    }

    private getViewData(workfolderPath: WorkfolderPath): BackwardCompatibilityViewData {
        let viewData = this._viewData.get(workfolderPath);
        if (!viewData) {
            viewData = new BackwardCompatibilityViewData();
            this._viewData.set(workfolderPath, viewData);
        }
        return viewData;
    }

    private getHtmlForWebview(webview: Webview): string {
        const extensionUri = this.context.extensionUri;

        const mainJsUrl = webview.asWebviewUri(getJsScript(extensionUri, MAIN_JS_PATH));
        const scriptUri = webview.asWebviewUri(getJsScript(extensionUri, BWC_JS_PATH));
        const elementsUri = webview.asWebviewUri(getElements(extensionUri));
        const styleUri = webview.asWebviewUri(getStyle(extensionUri));
        const codiconsUri = webview.asWebviewUri(getCodicon(extensionUri));
        const nonce = getNonce();

        return `
            <!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Backward Compatibility Check</title>
                <link href="${codiconsUri}" rel="stylesheet" id="vscode-codicon-stylesheet"/>
                <link href="${styleUri}" rel="stylesheet"/>
                <style nonce="${nonce}">
                    .bwc-checkbox-row {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    #bwc-spinner {
                        display: none;
                        margin-top: 2px;
                    }
                    #bwc-spinner.show {
                        display: inline-flex;
                        align-items: center;
                    }
                </style>
			</head>
			<body>
                <vscode-form-group variant="vertical">
                    <p class="bwc-checkbox-row">
                        <vscode-checkbox id="${BackwardCompatibilityFields.RUN_CHECK}">
                            Run backward compatibility check
                        </vscode-checkbox>
                        <span id="bwc-spinner">
                            <i class="codicon codicon-loading codicon-modifier-spin"></i>
                        </span>
                    </p>
                    <p>
                        <vscode-label for="${BackwardCompatibilityFields.BASELINE_REFERENCE}">Baseline git reference:</vscode-label>
                        <vscode-textfield
                            id="${BackwardCompatibilityFields.BASELINE_REFERENCE}"
                            value="${BWC_DEFAULT_BASELINE_REFERENCE}"
                            disabled
                        />
                    </p>
                    <p>
                        <vscode-checkbox id="${BackwardCompatibilityFields.EXCLUDE_COMPONENTS_SCOPE}" checked disabled>
                            Exclude changes with components scope
                        </vscode-checkbox>
                    </p>
                </vscode-form-group>
                <script nonce="${nonce}"
                    src="${elementsUri}"
                    type="module"
                ></script>
                <script nonce="${nonce}" src="${mainJsUrl}"></script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>
            `;
    }
}

