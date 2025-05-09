export const DRAFT = 'draft';
export const RELEASE = 'release';
export const ARCHIVED = 'archived';
export const PUBLISHING_STATUSES = [DRAFT, RELEASE, ARCHIVED];
export const PUBLISHING_JS_PATH = 'publishing.js';
export const PUBLISHING_INPUT_DRAFT_PATTERN = '[A-Za-z0-9_.~\\-]{1,}';
export const PUBLISHING_INPUT_RELEASE_PATTERN = '^[0-9]{4}[.]{1}[1-4]{1}$';
export const PUBLISHING_NO_PREVIOUS_VERSION = 'No previous release version';
export const PUBLISHING_LOADING_OPTION = 'Loading...';

export const PUBLISHING_WEBVIEW = 'publishingWebview';
export const STATUS_BAR_PUBLISH_MESSAGE = 'Publication to APIHUB Portal';
export const STATUS_BAR_TEXT = `$(sync~spin) ${STATUS_BAR_PUBLISH_MESSAGE}`;

export const STATUS_REFETCH_INTERVAL = 3000;
export const STATUS_REFETCH_MAX_ATTEMPTS = 2000;

export const PUBLISHING_DATA_NAME = "package.zip";

export const PUBLISHING_SUCCESSFUL_MESSAGE = "Package version was successfully published in APIHUB Portal";
export const PUBLISHING_BUTTON_LINK_MESSAGE = "Check it out";