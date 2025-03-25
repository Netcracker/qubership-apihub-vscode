import { expect } from 'chai';
import { ActivityBar, By, SideBarView, ViewControl, ViewSection, WebElement, WebView } from 'vscode-extension-tester';
import { EnvironmentWebviewFields } from '../common/models/enviroment.model';
import { PublishFields } from '../common/models/publish.model';
import { DISABLED_ATTRIBUTE, INVALID_ATTRIBUTE, REQUIRED_ATTRIBUTE } from './constants/attribute.constants';
import { LOCAL_SERVER_FULL_URL, TEST_PAT_TOKEN } from './constants/environment.constants';
import { EXTENTSION_NAME, PLUGIN_SECTIONS } from './constants/test.constants';
import { LabelData } from './models/label.model';
import { SENGLE_SELECT_LOCATOR, TEXT_FIELD_LOCATOR } from './models/webview.model';
import { PACKAGE_ID_NAME } from './server/data/packages';
import { LocalServer } from './server/localServer';
import { clearTextField, expandAll, findWebElementById, getLabels, getWebView, Until } from './utils/webview.utils';

const LABELS_DATA: LabelData[] = [
    { label: 'Package Id:', required: true },
    { label: 'Version:', required: true },
    { label: 'Status:', required: true },
    { label: 'Labels:', required: false },
    { label: 'Previous release version:', required: true }
];

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

        it('Check required empty Environment fields if PackageId is fill', async function () {
            await switchToEnvironments();
            await findEnvFields();

            await clearTextField(urlField);
            await clearTextField(tokenField);

            await switchToPublish();
            await findPublishFields();

            await packageIdField?.sendKeys(PACKAGE_ID_NAME);

            await new Promise((res) => setTimeout(res, 500));

            await switchToEnvironments();
            await findEnvFields();

            const isUrlFieldInvalid = await urlField
                ?.getDriver()
                .wait(async () => Until.getAttribute(urlField, REQUIRED_ATTRIBUTE, 'true'), 5000);
            expect(isUrlFieldInvalid).to.equal('true');

            const isTokenFieldInvalid = await tokenField
                ?.getDriver()
                .wait(async () => Until.getAttribute(tokenField, REQUIRED_ATTRIBUTE, 'true'), 5000);
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

            await new Promise((res) => setTimeout(res, 1000));

            const isPackageIdFieldNoInvalid = await packageIdField
                ?.getDriver()
                .wait(async () => Until.getAttribute(packageIdField, INVALID_ATTRIBUTE, "false"), 5000);
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

        it.skip('Check load PackageId after click test connection', async function () {
            await switchToEnvironments();
            await findEnvFields();

            await clearTextField(urlField);
            await clearTextField(tokenField);

            await switchToPublish();
            await findPublishFields();

            await packageIdField?.sendKeys(PACKAGE_ID_NAME);
            await checkDependentFieldsAreDisabled(true);

            await switchToEnvironments();
            await findEnvFields();

            await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
            await tokenField?.sendKeys(TEST_PAT_TOKEN);

            await testConnectionButton?.click();

            await switchToPublish();
            await findPublishFields();

            await new Promise((res) => setTimeout(res, 1000));

            const isPackageIdFieldInvalid = await packageIdField
                ?.getDriver()
                .wait(async () => Until.getAttribute(packageIdField, INVALID_ATTRIBUTE, 'false'), 5000);
            expect(isPackageIdFieldInvalid).to.equal('false');
            
            await checkDependentFieldsAreDisabled(false);
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
