import { expect } from 'chai';
import * as fs from 'fs';
import {
    ActivityBar,
    By,
    CustomTreeItem,
    Key,
    SideBarView,
    StatusBar,
    ViewControl,
    ViewSection,
    VSBrowser,
    WebElement,
    WebView,
    Workbench
} from 'vscode-extension-tester';
import {
    PUBLISH_INPUT_DRAFT_PATTERN,
    PUBLISH_NO_PREVIOUS_VERSION,
    STATUS_BAR_PUBLISH_MESSAGE
} from '../common/constants/publish.constants';
import { EnvironmentWebviewFields } from '../common/models/environment.model';
import { PublishFields } from '../common/models/publish.model';
import {
    DISABLED_ATTRIBUTE,
    INVALID_ATTRIBUTE,
    PATTERN_ATTRIBUTE,
    REQUIRED_ATTRIBUTE
} from './constants/attribute.constants';
import { LOCAL_SERVER_FULL_URL, TEST_PAT_TOKEN } from './constants/environment.constants';
import {
    CONFIG_FILE_1,
    CONFIG_FILE_2,
    CONFIG_FILE_3,
    PUBLISH_NOTIFICATION_MESSAGE
} from './constants/publish.constants';
import {
    DOCUMENTS_SECTION,
    EXTENSION_NAME,
    PACKAGE_ID_NAME,
    PACKAGE_ID_RELEASE_NAME,
    PACKAGE_ID_VERSIONS_NAME,
    PLUGIN_SECTIONS,
    RELEASE_VERSION_PATTERN,
    VERSION_1,
    VERSION_2,
    VERSION_3,
    VERSION_LABEL
} from './constants/test.constants';
import { CONFIG_FILE_1_PATH, PETS_NAME, WORKSPACE_1_PATH, WORKSPACE_3_PATH } from './constants/tree.constants';
import { LabelData } from './models/label.model';
import { BUTTON_LOCATOR, SINGLE_SELECT_LOCATOR, TEXT_FIELD_LOCATOR } from './models/webview.model';
import { deleteFile } from './utils/explorer.utils';
import { clickCheckbox } from './utils/tree.utils';
import {
    clearTextField,
    clickOption,
    closeSelect,
    expandAll,
    findAsync,
    findWebElementById,
    getFieldLabels,
    getPatternMismatch,
    getSingleSelectOptions,
    getTexts,
    getTextValue,
    getWebView,
    openSelect,
    Until
} from './utils/webview.utils';

const LABELS_DATA: LabelData[] = [
    { label: 'Package Id:', required: true },
    { label: 'Version:', required: true },
    { label: 'Status:', required: true },
    { label: 'Labels:', required: false },
    { label: 'Previous release version:', required: true }
];

const DRAFT = 'Draft';
const RELEASE = 'Release';
const ARCHIVED = 'Archived';

const RELEASE_VERSION = '2025.1';
const NONE_RELEASE_VERSION = 'none-release-version';
const BROKEN_VERSION = 'broken-version!%#';

const LABEL_NAME = 'label';
const LABEL_LONG_NAME = 'Loooooooooooooooooooooooooooong';
const LABEL_SHORT_NAME = 'S';

describe('Publish Tests', () => {
    let viewControl: ViewControl | undefined;
    let sideBar: SideBarView | undefined;
    let sections: ViewSection[] | undefined;
    let webview: WebView;
    let packageIdField: WebElement | undefined;
    let versionField: WebElement | undefined;
    let statusField: WebElement | undefined;
    let labelsField: WebElement | undefined;
    let previousReleaseVersion: WebElement | undefined;
    let publishButton: WebElement | undefined;

    before(async () => {
        await prepareSections();

        await switchToFrame(PLUGIN_SECTIONS.PUBLISH);

        await findPublishFields();

        await webview.switchBack();

        deleteConfigFile();
    });

    after(async () => {
        await webview?.switchBack();

        await switchToFrame(PLUGIN_SECTIONS.PUBLISH);

        await findPublishFields();
        await cleanPublishFields();

        await webview.switchBack();

        deleteConfigFile();

        await expandAll(sections ?? []);

        await VSBrowser.instance.openResources(WORKSPACE_3_PATH);
    });

    describe('Publish Fields', function () {
        before(async () => {
            await switchToFrame(PLUGIN_SECTIONS.PUBLISH);
            await findPublishFields();
            await clearTextField(packageIdField);
        });

        after(async () => {
            await webview.switchBack();
        });

        it('Check labels required', async () => {
            const vsLabels = await webview.findWebElements(By.css('vscode-label'));
            const labels: LabelData[] = await getFieldLabels(vsLabels);
            expect(labels).to.deep.equal(LABELS_DATA);
        });

        it('Check disabled fields if package Id is empty', async () => {
            const isPackageIdFieldDisabled = await packageIdField?.getAttribute(DISABLED_ATTRIBUTE);
            expect(isPackageIdFieldDisabled).to.be.oneOf([false, null]);

            await new Promise((res) => setTimeout(res, 500));

            await checkDependentFieldsAreDisabled(true);
        });

        it('Check "Previous Version" set default value', async function () {
            const previousReleaseVersionValue = await getTextValue(previousReleaseVersion);
            expect(previousReleaseVersionValue).is.equals(PUBLISH_NO_PREVIOUS_VERSION);
        });
    });

    describe('Publish and Environment integration', function () {
        let urlField: WebElement | undefined;
        let tokenField: WebElement | undefined;
        let testConnectionButton: WebElement | undefined;

        describe('PackageId tests', function () {
            afterEach(async () => {
                await switchAndCleanEnvironmentFields();
                await switchAndCleanPublishFields();

                await new Promise((res) => setTimeout(res, 2000));
            });

            it('Check required empty Environment fields if PackageId is fill', async function () {
                await switchToPublish();

                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await new Promise((res) => setTimeout(res, 2000));

                await switchToEnvironments();

                const isUrlFieldInvalid = await urlField?.getAttribute(REQUIRED_ATTRIBUTE);
                expect(isUrlFieldInvalid).to.equal('true');

                const isTokenFieldInvalid = await tokenField?.getAttribute(REQUIRED_ATTRIBUTE);
                expect(isTokenFieldInvalid).to.equal('true');
            });

            it('Check available all fields if PackageId is correct', async function () {
                await switchToEnvironments();

                await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
                await tokenField?.sendKeys(TEST_PAT_TOKEN);

                await switchToPublish();

                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await new Promise((res) => setTimeout(res, 2000));

                const isPackageIdFieldNoInvalid = await packageIdField
                    ?.getDriver()
                    .wait(async () => Until.getAttribute(packageIdField, INVALID_ATTRIBUTE, 'false'), 5000);
                expect(isPackageIdFieldNoInvalid).to.equal('false');

                await checkDependentFieldsAreDisabled(false);
            });

            it('Check invalid packageId field if none exist PackageId', async function () {
                await switchToEnvironments();

                await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
                await tokenField?.sendKeys(TEST_PAT_TOKEN);

                await switchToPublish();

                await packageIdField?.sendKeys('noneExistPackageId');

                const isPackageIdFieldInvalid = await packageIdField
                    ?.getDriver()
                    .wait(async () => Until.getAttribute(packageIdField, INVALID_ATTRIBUTE, 'true'), 5000);
                expect(isPackageIdFieldInvalid).to.equal('true');

                await checkDependentFieldsAreDisabled(true);
            });

            it('Check load PackageId after click test connection', async function () {
                await switchToPublish();

                await packageIdField?.sendKeys(PACKAGE_ID_NAME);
                await checkDependentFieldsAreDisabled(true);

                await switchToEnvironments();

                await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
                await tokenField?.sendKeys(TEST_PAT_TOKEN);

                await testConnectionButton?.click();

                await switchToPublish();

                const isPackageIdFieldInvalid = await packageIdField
                    ?.getDriver()
                    .wait(async () => Until.getAttribute(packageIdField, INVALID_ATTRIBUTE, 'false'), 5000);
                expect(isPackageIdFieldInvalid).to.equal('false');

                await checkDependentFieldsAreDisabled(false);
            });
        });

        describe('Publish e2e preparation', function () {
            before(async function () {
                await switchToEnvironments();

                await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
                await tokenField?.sendKeys(TEST_PAT_TOKEN);

                await switchToPublish();
            });

            afterEach(async () => {
                await cleanPublishFields();
                // WA. Delete after https://github.com/vscode-elements/elements/issues/369
                await findPublishFields();
                await new Promise((res) => setTimeout(res, 500));
            });

            it('Check Status Options', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await new Promise((res) => setTimeout(res, 2000));
                await openSelect(statusField);
                const options = await getSingleSelectOptions(statusField);
                const optionTexts = await Promise.all(options.map(async (option) => await option.getText()));

                expect(optionTexts).deep.equals([DRAFT, RELEASE, ARCHIVED]);
                await closeSelect(statusField);
            });

            it('Check changes in the Draft status pattern and validation', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await new Promise((res) => setTimeout(res, 2000));

                await clickOption(statusField, DRAFT);
                const statusPattern = await versionField?.getAttribute(PATTERN_ATTRIBUTE);
                expect(PUBLISH_INPUT_DRAFT_PATTERN).to.equals(statusPattern);

                await versionField?.sendKeys(RELEASE_VERSION);
                let isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.false;
                await clearTextField(versionField);

                await versionField?.sendKeys(NONE_RELEASE_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.false;
                await clearTextField(versionField);

                await versionField?.sendKeys(BROKEN_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.true;
                await clearTextField(versionField);
            });

            it('Check changes in the Release status pattern and validation', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await new Promise((res) => setTimeout(res, 2000));

                await clickOption(statusField, RELEASE);
                const statusPattern = await versionField?.getAttribute(PATTERN_ATTRIBUTE);
                expect(RELEASE_VERSION_PATTERN).to.equals(statusPattern);

                await versionField?.sendKeys(RELEASE_VERSION);
                let isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.false;
                await clearTextField(versionField);

                await versionField?.sendKeys(NONE_RELEASE_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.true;
                await clearTextField(versionField);

                await versionField?.sendKeys(BROKEN_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.true;
                await clearTextField(versionField);
            });

            it('Check changes in the Archived status pattern and validation', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await new Promise((res) => setTimeout(res, 2000));

                await clickOption(statusField, ARCHIVED);
                const statusPattern = await versionField?.getAttribute(PATTERN_ATTRIBUTE);
                expect(PUBLISH_INPUT_DRAFT_PATTERN).to.equals(statusPattern);

                await versionField?.sendKeys(RELEASE_VERSION);
                let isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.false;
                await clearTextField(versionField);

                await versionField?.sendKeys(NONE_RELEASE_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.false;
                await clearTextField(versionField);

                await versionField?.sendKeys(BROKEN_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.true;
                await clearTextField(versionField);
            });

            it('Check create some Labels be Enter and delete', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await new Promise((res) => setTimeout(res, 2000));

                await labelsField?.sendKeys(LABEL_NAME, Key.ENTER);
                await labelsField?.sendKeys(LABEL_LONG_NAME, Key.ENTER);
                await labelsField?.sendKeys(LABEL_SHORT_NAME, Key.ENTER);

                let labels = await getLabels();
                let labelNames: string[] = await getTexts(labels);
                expect(labelNames).to.be.an('array').with.lengthOf(3);
                expect(labelNames).deep.equals([LABEL_NAME, LABEL_LONG_NAME, LABEL_SHORT_NAME]);

                await deleteLabel(labels[1]);
                labels = await getLabels();
                labelNames = await getTexts(labels);
                expect(labelNames).deep.equals([LABEL_NAME, LABEL_SHORT_NAME]);

                await deleteLabel(labels[1]);
                labels = await getLabels();
                labelNames = await getTexts(labels);
                expect(labelNames).deep.equals([LABEL_NAME]);

                await deleteLabel(labels[0]);
                labels = await getLabels();
                expect(labels).to.be.empty;
            });

            it('Check create Labels using focusout', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await new Promise((res) => setTimeout(res, 2000));

                await labelsField?.sendKeys(LABEL_NAME);
                await labelsField?.sendKeys(Key.TAB);

                const labelFieldValue = await labelsField?.getText();
                expect(labelFieldValue).to.be.empty;

                let labels = await getLabels();
                const labelNames = await getTexts(labels);
                expect(labelNames).to.be.an('array').with.lengthOf(1);
                expect(labelNames[0]).to.be.equals(LABEL_NAME);

                await deleteLabel(labels[0]);
                labels = await getLabels();
                expect(labels).to.be.empty;
            });

            it('Check load label from version', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await new Promise((res) => setTimeout(res, 2000));

                await versionField?.sendKeys(VERSION_2);

                await new Promise((res) => setTimeout(res, 2000));

                let labels = await getLabels();
                const labelNames = await getTexts(labels);
                expect(labelNames).to.be.an('array').with.lengthOf(1);
                expect(labelNames[0]).to.be.equals(VERSION_LABEL);

                await deleteLabel(labels[0]);
                labels = await getLabels();
                expect(labels).to.be.empty;
            });

            it('Check "Previous Version" has default value', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_VERSIONS_NAME);

                await new Promise((res) => setTimeout(res, 2000));

                await openSelect(previousReleaseVersion);

                const options = await getSingleSelectOptions(previousReleaseVersion);
                const optionTexts = await Promise.all(options.map(async (option) => await option.getText()));

                expect(optionTexts).deep.equals([PUBLISH_NO_PREVIOUS_VERSION, VERSION_2, VERSION_1]);

                await options[0]?.click();

                const value = await previousReleaseVersion?.getAttribute('value');
                expect(value).is.equals(PUBLISH_NO_PREVIOUS_VERSION);
            });

            it('Check load "Previous Version" from package', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await new Promise((res) => setTimeout(res, 2000));

                await openSelect(previousReleaseVersion);

                const options = await getSingleSelectOptions(previousReleaseVersion);
                const optionTexts = await Promise.all(options.map(async (option) => await option.getText()));

                expect(optionTexts).deep.equals([PUBLISH_NO_PREVIOUS_VERSION, VERSION_2, VERSION_1]);

                await options[2]?.click();
                const value = await previousReleaseVersion?.getAttribute('value');
                expect(value).is.equals(VERSION_1);
            });

            it('Check "Previous Version" cannot select a non-existent version', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await new Promise((res) => setTimeout(res, 2000));

                await previousReleaseVersion?.sendKeys('non-existentVersion');
                await previousReleaseVersion?.sendKeys(Key.TAB + Key.TAB);

                // WA. Delete after https://github.com/vscode-elements/elements/issues/369
                await findPublishFields();

                const value = await previousReleaseVersion?.getAttribute('value');
                expect(value).is.empty;
            });

            describe('Publish', function () {
                let statusBar: StatusBar;

                before(async function () {
                    await webview.switchBack();
                    await VSBrowser.instance.openResources(WORKSPACE_1_PATH);
                    await prepareSections();
                    statusBar = new StatusBar();
                    await switchToPublish();
                });

                afterEach(async function () {
                    deleteConfigFile();
                });

                it('Check Success Publish: Status bar, Notification, Config File', async function () {
                    await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                    await new Promise((res) => setTimeout(res, 2000));

                    await versionField?.sendKeys(VERSION_3);
                    await clickOption(statusField, DRAFT);

                    await labelsField?.sendKeys('Publish-test' + Key.ENTER);
                    await clickOption(previousReleaseVersion, VERSION_2);

                    await publishButton?.click();

                    await new Promise((res) => setTimeout(res, 500));
                    await webview.switchBack();

                    const statusBarText = await statusBar.getText();
                    expect(statusBarText).includes(STATUS_BAR_PUBLISH_MESSAGE);

                    await new Promise((res) => setTimeout(res, 2000));

                    const notifications = await new Workbench().getNotifications();
                    const notificationsText = await notifications[0].getText();
                    expect(notificationsText).is.equals(PUBLISH_NOTIFICATION_MESSAGE);

                    expect(fs.existsSync(CONFIG_FILE_1_PATH)).to.be.true;
                    const configFileContent = fs.readFileSync(CONFIG_FILE_1_PATH, 'utf-8');

                    expect(configFileContent).is.equals(CONFIG_FILE_1);

                    await webview.switchToFrame();
                });

                it('Check re-creation Config File after Success Publish', async function () {
                    fs.writeFileSync(CONFIG_FILE_1_PATH, CONFIG_FILE_2, 'utf8');
                    await new Promise((res) => setTimeout(res, 1000));

                    await clearTextField(packageIdField);
                    await packageIdField?.sendKeys(PACKAGE_ID_RELEASE_NAME);
                    await webview.switchBack();

                    await expandAll(sections);
                    const treeSection = await sideBar?.getContent().getSection(DOCUMENTS_SECTION);
                    const items: CustomTreeItem[] = ((await treeSection?.getVisibleItems()) as CustomTreeItem[]) ?? [];
                    const item = await findAsync(items, async (item) => (await item.getLabel()) === PETS_NAME);
                    await clickCheckbox(item);

                    await switchToPublish();
                    await findPublishFields();

                    await versionField?.sendKeys(VERSION_3);
                    await clickOption(statusField, RELEASE);

                    await labelsField?.sendKeys('Publish-release-test' + Key.ENTER);
                    await clickOption(previousReleaseVersion, PUBLISH_NO_PREVIOUS_VERSION);

                    await publishButton?.click();

                    await new Promise((res) => setTimeout(res, 2000));

                    expect(fs.existsSync(CONFIG_FILE_1_PATH)).to.be.true;
                    const configFileContent = fs.readFileSync(CONFIG_FILE_1_PATH, 'utf-8');

                    expect(configFileContent).is.equals(CONFIG_FILE_3);

                    await new Promise((res) => setTimeout(res, 500));
                });
            });
        });

        const findEnvironmentFields = async (): Promise<void> => {
            const textFields = await webview.findWebElements(TEXT_FIELD_LOCATOR);
            urlField = await findWebElementById(textFields, EnvironmentWebviewFields.URL);
            tokenField = await findWebElementById(textFields, EnvironmentWebviewFields.TOKEN);
            testConnectionButton = await webview.findWebElement(By.css('a'));
        };

        const switchAndCleanPublishFields = async (): Promise<void> => {
            await switchToPublish();

            await cleanPublishFields();

            await webview.switchBack();
        };

        const switchAndCleanEnvironmentFields = async (): Promise<void> => {
            await switchToEnvironments();

            await clearTextField(urlField);
            await clearTextField(tokenField);

            await webview.switchBack();
        };

        const switchTo = async (section: PLUGIN_SECTIONS): Promise<void> => {
            await webview.switchBack();
            await expandAll(sections ?? []);
            await switchToFrame(section);
        };

        const switchToEnvironments = async (): Promise<void> => {
            await switchTo(PLUGIN_SECTIONS.ENVIRONMENT);
            await findEnvironmentFields();
        };

        const switchToPublish = async (): Promise<void> => {
            await switchTo(PLUGIN_SECTIONS.PUBLISH);
            await findPublishFields();
        };
    });

    const findPublishFields = async (): Promise<void> => {
        const textFields = await webview.findWebElements(TEXT_FIELD_LOCATOR);
        const selectFields = await webview.findWebElements(SINGLE_SELECT_LOCATOR);
        const buttons = await webview.findWebElements(BUTTON_LOCATOR);
        packageIdField = await findWebElementById(textFields, PublishFields.PACKAGE_ID);
        versionField = await findWebElementById(textFields, PublishFields.VERSION);
        statusField = await findWebElementById(selectFields, PublishFields.STATUS);
        labelsField = await findWebElementById(textFields, PublishFields.LABELS);
        previousReleaseVersion = await findWebElementById(selectFields, PublishFields.PREVIOUS_VERSION);
        publishButton = await findWebElementById(buttons, PublishFields.PUBLISH_BUTTON);
    };

    const deleteLabel = async (label: WebElement): Promise<void> => {
        await label.click();
    };

    const getLabels = async (): Promise<WebElement[]> => {
        let labelPlaceholder;
        try {
            labelPlaceholder = await webview.findWebElement(By.id('publish-labels-placeholder'));
        } catch {
            return [];
        }
        return (await labelPlaceholder.findElements(BUTTON_LOCATOR)) ?? [];
    };

    const checkDependentFieldsAreDisabled = async (isDisabled: boolean): Promise<void> => {
        const list: (string | null)[] = isDisabled ? ['true'] : ['false', null];

        const isVersionFieldDisabled = await versionField?.getAttribute(DISABLED_ATTRIBUTE);
        expect(isVersionFieldDisabled).to.be.oneOf(list);

        const isStatusFieldDisabled = await statusField?.getAttribute(DISABLED_ATTRIBUTE);
        expect(isStatusFieldDisabled).to.be.oneOf(list);

        const isLabelsFieldDisabled = await labelsField?.getAttribute(DISABLED_ATTRIBUTE);
        expect(isLabelsFieldDisabled).to.be.oneOf(list);

        const isPreviousReleaseVersionDisabled = await previousReleaseVersion?.getAttribute(DISABLED_ATTRIBUTE);
        expect(isPreviousReleaseVersionDisabled).to.be.oneOf(list);
    };

    const prepareSections = async (): Promise<void> => {
        viewControl = await new ActivityBar().getViewControl(EXTENSION_NAME);
        sideBar = await viewControl?.openView();
        sections = await sideBar?.getContent().getSections();
    };

    const cleanPublishFields = async (): Promise<void> => {
        try {
            await clearTextField(previousReleaseVersion);
        } catch {}
        try {
            const labels = await getLabels();
            for (const label of labels) {
                await deleteLabel(label);
            }
        } catch {}
        try {
            await clickOption(statusField, DRAFT);
        } catch {}
        try {
            await clearTextField(versionField);
        } catch {}
        try {
            await clearTextField(packageIdField);
        } catch {}
    };

    const deleteConfigFile = (): void => {
        deleteFile(CONFIG_FILE_1_PATH);
    };

    const switchToFrame = async (section: PLUGIN_SECTIONS): Promise<void> => {
        webview = await getWebView(sideBar, section);
        await webview.switchToFrame();
    };
});
