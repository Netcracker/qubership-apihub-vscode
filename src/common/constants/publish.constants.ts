export const DRAFT = 'draft';
export const RELEASE = 'release';
export const ARCHIVED = 'archived';
export const PUBLISH_STATUSES = [DRAFT, RELEASE, ARCHIVED];
export const PUBLISH_JS_PATH = 'publish.js';
export const PUBLISH_INPUT_DRAFT_PATTERN = '[A-Za-z0-9_.~\\-]{1,}';
export const PUBLISH_INPUT_RELEASE_PATTERN = '^[0-9]{4}[.]{1}[1-4]{1}$';
export const PUBLISH_NO_PREVIOUS_VERSION = 'No previous release version';
export const PUBLISH_LOADING_OPTION = 'Loading...';

export const PUBLISH_WEBVIEW = 'publishWebview';
export const STATUS_BAR_TEXT = "$(sync~spin) Publication to APIHUB Portal";

export const STATUS_REFETCH_INTERVAL = 3000;
export const STATUS_REFETCH_MAX_ATTEMPTS = 2000;

export const PUBLISH_DATA_NAME = "package.zip";