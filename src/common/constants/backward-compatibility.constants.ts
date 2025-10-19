export const EXTENSION_BWC_VIEW_NAME = 'apihubExtension.backwardCompatibilityView';
export const BWC_WEBVIEW = 'backwardCompatibilityWebview';
export const BWC_JS_PATH = 'backward-compatibility.js';
export const BWC_DIAGNOSTIC_SOURCE = 'apihub-bwc-check';
export const BWC_DEFAULT_BASELINE_REFERENCE = 'develop';
export const BWC_GIT_VALIDATION_DEBOUNCE = 500;

export enum BackwardCompatibilityFields {
    RUN_CHECK = 'runCheck',
    BASELINE_REFERENCE = 'baselineReference',
    EXCLUDE_COMPONENTS_SCOPE = 'excludeComponentsScope'
}

