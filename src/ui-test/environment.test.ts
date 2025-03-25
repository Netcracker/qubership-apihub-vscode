import { expect } from 'chai';
import { ActivityBar, By, SideBarView, until, ViewControl, WebElement, WebView } from 'vscode-extension-tester';
import { EnvironmentWebviewFields } from '../common/models/enviroment.model';
import { INVALID_ATTRIBUTE, NAME_ATTRIBUTE } from './constants/attribute.constants';
import { LOCAL_SERVER_FULL_URL, TEST_BROKEN_PAT_TOKEN, TEST_PAT_TOKEN } from './constants/environment.constants';
import { ENVIRONMENT_SECTION, EXTENTSION_NAME } from './constants/test.constants';
import { LabelData } from './models/label.model';
import { LocalServer } from './server/localServer';
import { findWebElementById, getLabels, Until } from './utils/webview.utils';
import { TEXT_FIELD_LOCATOR } from './models/webview.model';

const LABELS_DATA: LabelData[] = [
    { label: 'APIHUB URL:', required: true },
    { label: 'Authentication Token:', required: true }
];

describe.only('Environment Webview', () => {
    let webview: WebView;
    let urlField: WebElement | undefined;
    let tokenField: WebElement | undefined;
    let testConnectionButton: WebElement | undefined;

    before(async () => {
        const viewControl: ViewControl | undefined = await new ActivityBar().getViewControl(EXTENTSION_NAME);
        const sideBar: SideBarView | undefined = await viewControl?.openView();
        if (!sideBar) {
            return;
        }
        const envSection = await sideBar.getContent().getSection(ENVIRONMENT_SECTION);
        const webviewElem = await envSection.getDriver().wait(until.elementLocated(By.css('iframe')), 1000);
        if (!webviewElem) {
            throw new Error(`${ENVIRONMENT_SECTION} WebView not found`);
        }
        webview = new WebView(webviewElem, envSection);
        await webview.switchToFrame();

        const textFields = await webview.findWebElements(TEXT_FIELD_LOCATOR);
        urlField = await findWebElementById(textFields, EnvironmentWebviewFields.URL);
        tokenField = await findWebElementById(textFields, EnvironmentWebviewFields.TOKEN);
        testConnectionButton = await webview.findWebElement(By.css('a'));
    });

    after(async () => {
        await webview.switchBack();
    });

    beforeEach(async () => {
        await urlField?.sendKeys('');
        await tokenField?.sendKeys('');
    });

    it('Check labels required', async () => {
        const vsLabels = await webview.findWebElements(By.css('vscode-label'));
        const labels: LabelData[] = await getLabels(vsLabels);
        expect(labels).to.deep.equal(LABELS_DATA);
    });

    it('Check all field exist', async () => {
        expect(urlField).is.not.undefined;
        expect(tokenField).is.not.undefined;
        expect(testConnectionButton).is.not.undefined;
    });

    it('Check password button', async () => {
        await tokenField?.sendKeys(TEST_PAT_TOKEN);
        let type = await tokenField?.getAttribute('type');
        expect(type).is.equal('password');

        const icons = await webview.findWebElements(By.css('vscode-icon'));
        const eyeButton = await findWebElementById(icons, 'eye-icon');
        await eyeButton?.click();

        type = await tokenField?.getAttribute('type');
        expect(type).is.equal('text');
    });

    describe('Test connection', function () {
        let localServer: LocalServer;
        before(async function () {
            localServer = new LocalServer();
            await localServer.start();
            await new Promise((res) => setTimeout(res, 1000));
        });

        after(async () => {
            localServer.stop();
        });

        it('Check loading icon after click test', async function () {
            await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
            await tokenField?.sendKeys(TEST_PAT_TOKEN);

            const icons = await webview.findWebElements(By.css('vscode-icon'));
            const testConnectionIcon = await findWebElementById(icons, EnvironmentWebviewFields.TEST_CONNECTION_ICON);
            await testConnectionButton?.click();

            let testConnectionIconType = await testConnectionIcon
                ?.getDriver()
                .wait(async () => Until.getAttribute(testConnectionIcon, NAME_ATTRIBUTE, 'loading'), 5000);

            expect(testConnectionIconType).to.equal('loading');
            console.log(await webview.getDriver().takeScreenshot());
            await testConnectionIcon
                ?.getDriver()
                .wait(async () => Until.getAttribute(testConnectionIcon, NAME_ATTRIBUTE, 'check'), 5000);
        });

        it('Check successful icon after click test', async function () {
            await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
            await tokenField?.sendKeys(TEST_PAT_TOKEN);

            await testConnectionButton?.click();
            const icons = await webview.findWebElements(By.css('vscode-icon'));
            const testConnectionIcon = await findWebElementById(icons, EnvironmentWebviewFields.TEST_CONNECTION_ICON);

            let testConnectionIconType = await testConnectionIcon
                ?.getDriver()
                .wait(async () => Until.getAttribute(testConnectionIcon, NAME_ATTRIBUTE, 'check'), 5000);

            expect(testConnectionIconType).to.equal('check');
        });

        it('Check faild icon after click test', async function () {
            await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
            await tokenField?.sendKeys(TEST_BROKEN_PAT_TOKEN);
            await testConnectionButton?.click();
            const icons = await webview.findWebElements(By.css('vscode-icon'));
            const testConnectionIcon = await findWebElementById(icons, EnvironmentWebviewFields.TEST_CONNECTION_ICON);

            await new Promise((res) => setTimeout(res, 1000));

            console.log(await webview.getDriver().takeScreenshot());
            let testConnectionIconType = await testConnectionIcon?.getAttribute(NAME_ATTRIBUTE);
            expect(testConnectionIconType).to.equal('close');
        });

        it('Check url field error after click test', async function () {
            await urlField?.sendKeys('broken_url');
            await tokenField?.sendKeys(TEST_PAT_TOKEN);
            await testConnectionButton?.click();

            await new Promise((res) => setTimeout(res, 500));

            const isUrlFieldInvalid = await urlField
                ?.getDriver()
                .wait(async () => Until.getAttribute(urlField, INVALID_ATTRIBUTE, 'true'), 5000);
            const isTokenFieldInvalid = await tokenField?.getAttribute(INVALID_ATTRIBUTE);

            expect(isUrlFieldInvalid).to.equal('true');
            expect(isTokenFieldInvalid).to.equal('false');
        });

        it('Check Token field error after click test', async function () {
            await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
            await tokenField?.sendKeys(TEST_BROKEN_PAT_TOKEN);
            await testConnectionButton?.click();

            await new Promise((res) => setTimeout(res, 2000));

            const isTokenFieldInvalid = await tokenField?.getAttribute(INVALID_ATTRIBUTE);
            const isUrlFieldInvalid = await urlField?.getAttribute(INVALID_ATTRIBUTE);
            console.log(await webview.getDriver().takeScreenshot());
            expect(isUrlFieldInvalid).to.equal('false');
            expect(isTokenFieldInvalid).to.equal('true');
        });
    });
});
