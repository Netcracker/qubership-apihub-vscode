import { expect } from 'chai';
import {
    ActivityBar,
    By,
    Key,
    SideBarView,
    ViewControl,
    ViewSection,
    WebElement,
    WebView
} from 'vscode-extension-tester';
import { PUBLISH_INPUT_DRAFT_PATTERN, PUBLISH_NO_PREVIOUS_VERSION } from '../common/constants/publish.constants';
import { EnvironmentWebviewFields } from '../common/models/enviroment.model';
import { PublishFields } from '../common/models/publish.model';
import {
    DISABLED_ATTRIBUTE,
    INVALID_ATTRIBUTE,
    PATTERN_ATTRIBUTE,
    REQUIRED_ATTRIBUTE
} from './constants/attribute.constants';
import { LOCAL_SERVER_FULL_URL, TEST_PAT_TOKEN } from './constants/environment.constants';
import { EXTENTSION_NAME, PLUGIN_SECTIONS } from './constants/test.constants';
import { LabelData } from './models/label.model';
import { BUTTON_LOCATOR, SENGLE_SELECT_LOCATOR, TEXT_FIELD_LOCATOR } from './models/webview.model';
import { PACKAGE_ID_NAME, RELEASE_VERSION_PATTERN } from './server/data/packages';
import { LocalServer } from './server/localServer';
import {
    clearTextField,
    clickOption,
    expandAll,
    findWebElementById,
    getLabels,
    getPatternMismatch,
    getSingleSelectOptions,
    getTexts,
    getWebView,
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

describe('Publsih Test', () => {
    let sideBar: SideBarView | undefined;
    let sections: ViewSection[] | undefined;
    let webview: WebView;
    let packageIdField: WebElement | undefined;
    let versionField: WebElement | undefined;
    let statusField: WebElement | undefined;
    let labelsField: WebElement | undefined;
    let previousReleaseVersion: WebElement | undefined;

    before(async () => {
        const viewControl: ViewControl | undefined = await new ActivityBar().getViewControl(EXTENTSION_NAME);
        sideBar = await viewControl?.openView();
        sections = await sideBar?.getContent().getSections();
        webview = await getWebView(sideBar, PLUGIN_SECTIONS.PUBLISH);
        await webview.switchToFrame();

        await findPublishFields();
    });

    after(async () => {
        await webview.switchBack();
        await expandAll(sections ?? []);
    });

    it('Check labels required', async () => {
        const vsLabels = await webview.findWebElements(By.css('vscode-label'));
        const labels: LabelData[] = await getLabels(vsLabels);
        expect(labels).to.deep.equal(LABELS_DATA);
    });

    it('Check disabled fields if package Id is empty', async () => {
        await packageIdField?.sendKeys('');
        const isPackageIdFieldDisabled = await packageIdField?.getAttribute(DISABLED_ATTRIBUTE);
        expect(isPackageIdFieldDisabled).to.be.oneOf([false, null]);

        await new Promise((res) => setTimeout(res, 500));

        await checkDependentFieldsAreDisabled(true);
    });

    describe('Publish and Environment integration', function () {
        let localServer: LocalServer;
        let urlField: WebElement | undefined;
        let tokenField: WebElement | undefined;
        let testConnectionButton: WebElement | undefined;

        before(async function () {
            localServer = new LocalServer();
            await localServer.start();
        });

        after(async () => {
            localServer.stop();
        });

        afterEach(async () => {
            await switchToPublish();
            await findPublishFields();
            await clearTextField(packageIdField);
        });

        it('Check required empty Environment fields if PackageId is fill', async function () {
            await switchToEnvironments();
            await findEnvFields();

            await clearTextField(urlField);
            await clearTextField(tokenField);

            await switchToPublish();
            await findPublishFields();

            await packageIdField?.sendKeys(PACKAGE_ID_NAME);

            await new Promise((res) => setTimeout(res, 2000));

            await switchToEnvironments();
            await findEnvFields();

            const isUrlFieldInvalid = await urlField?.getAttribute(REQUIRED_ATTRIBUTE);
            expect(isUrlFieldInvalid).to.equal('true');

            const isTokenFieldInvalid = await tokenField?.getAttribute(REQUIRED_ATTRIBUTE);
            expect(isTokenFieldInvalid).to.equal('true');
        });

        it('Check available all fields if PackageId is correct', async function () {
            await switchToEnvironments();
            await findEnvFields();

            await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
            await tokenField?.sendKeys(TEST_PAT_TOKEN);

            await switchToPublish();
            await findPublishFields();

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
            await findEnvFields();

            await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
            await tokenField?.sendKeys(TEST_PAT_TOKEN);

            await switchToPublish();
            await findPublishFields();

            await packageIdField?.sendKeys('noneExistPackageId');

            const isPackageIdFieldInvalid = await packageIdField
                ?.getDriver()
                .wait(async () => Until.getAttribute(packageIdField, INVALID_ATTRIBUTE, 'true'), 5000);
            expect(isPackageIdFieldInvalid).to.equal('true');

            await checkDependentFieldsAreDisabled(true);
        });

        it('Check load PackageId after click test connection', async function () {
            await switchToEnvironments();
            await findEnvFields();

            await clearTextField(urlField);
            await clearTextField(tokenField);

            await new Promise((res) => setTimeout(res, 2000));

            await switchToPublish();
            await findPublishFields();

            await new Promise((res) => setTimeout(res, 1000));

            await packageIdField?.sendKeys(PACKAGE_ID_NAME);
            await checkDependentFieldsAreDisabled(true);

            await switchToEnvironments();
            await findEnvFields();

            await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
            await tokenField?.sendKeys(TEST_PAT_TOKEN);

            await testConnectionButton?.click();

            await switchToPublish();
            await findPublishFields();

            const isPackageIdFieldInvalid = await packageIdField
                ?.getDriver()
                .wait(async () => Until.getAttribute(packageIdField, INVALID_ATTRIBUTE, 'false'), 5000);
            expect(isPackageIdFieldInvalid).to.equal('false');

            await checkDependentFieldsAreDisabled(false);
        });

        /** Tests with a only correct environment */
        describe('Publish e2e', function () {
            before(async function () {
                await switchToEnvironments();
                await findEnvFields();

                await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
                await tokenField?.sendKeys(TEST_PAT_TOKEN);

                await switchToPublish();
                await findPublishFields();
            });

            afterEach(async () => {
                const labels = await getLabels();
                for (const label of labels) {
                    await deleteLabel(label);
                }
                await clearTextField(versionField);
                await clearTextField(packageIdField);
            });

            it('Check Status Options', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await new Promise((res) => setTimeout(res, 2000));
                await statusField?.click();
                const options = await getSingleSelectOptions(statusField);
                const optionTexts = await Promise.all(options.map(async (option) => await option.getText()));

                expect(optionTexts).deep.equals([DRAFT, RELEASE, ARCHIVED]);
                await statusField?.click();
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

                await versionField?.sendKeys(NONE_RELEASE_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.false;

                await versionField?.sendKeys(BROKEN_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.true;
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

                await versionField?.sendKeys(NONE_RELEASE_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.true;

                await versionField?.sendKeys(BROKEN_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.true;
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

                await versionField?.sendKeys(NONE_RELEASE_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.false;

                await versionField?.sendKeys(BROKEN_VERSION);
                isVersionFieldPatternMismatch = await getPatternMismatch(versionField);
                expect(isVersionFieldPatternMismatch).to.be.true;
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
            
            it.only('Check Previous Version has default value', async function () {
                await packageIdField?.sendKeys(PACKAGE_ID_NAME);

                await new Promise((res) => setTimeout(res, 2000));

                await previousReleaseVersion?.click();

                const options = await getSingleSelectOptions(previousReleaseVersion);
                const optionTexts = await Promise.all(options.map(async (option) => await option.getText()));

                expect(optionTexts).deep.equals([PUBLISH_NO_PREVIOUS_VERSION]);

                await options[0]?.click();
                const value = await previousReleaseVersion?.getText();
                expect(value).is.equals(PUBLISH_NO_PREVIOUS_VERSION);
            });
        });

        const switchTo = async (section: PLUGIN_SECTIONS): Promise<void> => {
            await webview.switchBack();
            await expandAll(sections ?? []);

            webview = await getWebView(sideBar, section);
            await webview.switchToFrame();
        };

        const switchToEnvironments = async (): Promise<void> => {
            await switchTo(PLUGIN_SECTIONS.ENVIRONMENT);
        };

        const switchToPublish = async (): Promise<void> => {
            await switchTo(PLUGIN_SECTIONS.PUBLISH);
        };

        const findEnvFields = async (): Promise<void> => {
            const textFields = await webview.findWebElements(TEXT_FIELD_LOCATOR);
            urlField = await findWebElementById(textFields, EnvironmentWebviewFields.URL);
            tokenField = await findWebElementById(textFields, EnvironmentWebviewFields.TOKEN);
            testConnectionButton = await webview.findWebElement(By.css('a'));
        };

        const getLabels = async (): Promise<WebElement[]> => {
            let labelPlaceholder;
            try {
                labelPlaceholder = await webview.findWebElement(By.id('pulbish-labels-placeholder'));
            } catch {
                return [];
            }
            return (await labelPlaceholder.findElements(BUTTON_LOCATOR)) ?? [];
        };

        const deleteLabel = async (label: WebElement): Promise<void> => {
            await label.click();
        };
    });

    const findPublishFields = async (): Promise<void> => {
        const textFields = await webview.findWebElements(TEXT_FIELD_LOCATOR);
        const selectFields = await webview.findWebElements(SENGLE_SELECT_LOCATOR);
        packageIdField = await findWebElementById(textFields, PublishFields.PACKAGE_ID);
        versionField = await findWebElementById(textFields, PublishFields.VERSION);
        statusField = await findWebElementById(selectFields, PublishFields.STATUS);
        labelsField = await findWebElementById(textFields, PublishFields.LABELS);
        previousReleaseVersion = await findWebElementById(selectFields, PublishFields.PREVIOUS_VERSION);
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
});
