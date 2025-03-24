import { expect } from 'chai';
import { ActivityBar, By, SideBarView, until, ViewControl, WebElement, WebView } from 'vscode-extension-tester';
import { EnvironmentWebviewFields } from '../common/models/enviroment.model';
import { LOCAL_SERVER_FULL_URL, TEST_BROKEN_PAT_TOKEN, TEST_PAT_TOKEN } from './constants/environment.constants';
import { ENVIRONMENT_SECTION, EXTENTSION_NAME } from './constants/test.constants';
import { LocalServer } from './utils/localServer';
import { findWebElementById, Until } from './utils/webview.utils';

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

        const textFields = await webview.findWebElements(By.css('vscode-textfield'));
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
        const labels = await webview.findWebElements(By.css('vscode-label'));
        const attributes = await Promise.all(labels.map((label) => label.getAttribute('required')));
        expect(attributes.every((attr) => attr === 'true')).to.be.true;
    });

    it('Check all field exist', async () => {
        expect(urlField).is.not.undefined;
        expect(tokenField).is.not.undefined;
        expect(testConnectionButton).is.not.undefined;
    });

    it('Check password button', async () => {
        await tokenField?.sendKeys(TEST_PAT_TOKEN);
        let type = await tokenField?.getAttribute('type');
        expect(type).is.eq('password');

        const icons = await webview.findWebElements(By.css('vscode-icon'));
        const eyeButton = await findWebElementById(icons, 'eye-icon');
        await eyeButton?.click();

        type = await tokenField?.getAttribute('type');
        expect(type).is.eq('text');
    });

    describe('Test connection', function () {
        let localServer: LocalServer;
        before(async function () {
            localServer = new LocalServer();
            localServer.start();
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
            console.log(await webview.getDriver().takeScreenshot());
            let testConnectionIconType = await testConnectionIcon
                ?.getDriver()
                .wait(async () => Until.getAttribute(testConnectionIcon, 'name', 'loading'), 5000);
                
            expect(testConnectionIconType).eq('loading');

            await testConnectionIcon
                ?.getDriver()
                .wait(async () => Until.getAttribute(testConnectionIcon, 'name', 'check'), 5000);
        });

        it('Check successful icon after click test', async function () {
            await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
            await tokenField?.sendKeys(TEST_PAT_TOKEN);
            await testConnectionButton?.click();
            const icons = await webview.findWebElements(By.css('vscode-icon'));
            const testConnectionIcon = await findWebElementById(icons, EnvironmentWebviewFields.TEST_CONNECTION_ICON);
            console.log(await webview.getDriver().takeScreenshot());
            let testConnectionIconType = await testConnectionIcon
                ?.getDriver()
                .wait(async () => Until.getAttribute(testConnectionIcon, 'name', 'check'), 5000);

            expect(testConnectionIconType).eq('check');
        });

        it('Check faild icon after click test', async function () {
            await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
            await tokenField?.sendKeys(TEST_BROKEN_PAT_TOKEN);
            await testConnectionButton?.click();
            const icons = await webview.findWebElements(By.css('vscode-icon'));
            const testConnectionIcon = await findWebElementById(icons, EnvironmentWebviewFields.TEST_CONNECTION_ICON);
            console.log(await webview.getDriver().takeScreenshot());
            let testConnectionIconType = await testConnectionIcon
                ?.getDriver()
                .wait(async () => Until.getAttribute(testConnectionIcon, 'name', 'close'), 5000);

            expect(testConnectionIconType).eq('close');
        });

        it('Check url field error after click test', async function () {
            await urlField?.sendKeys('broken_url');
            await tokenField?.sendKeys(TEST_PAT_TOKEN);
            await testConnectionButton?.click();

            await new Promise((res) => setTimeout(res, 500));

            const isUrlFieldInvalid = await urlField
                ?.getDriver()
                .wait(async () => Until.getAttribute(urlField, 'invalid', 'true'), 5000);
            const isTokenFieldInvalid = await tokenField?.getAttribute('invalid');
            console.log(await webview.getDriver().takeScreenshot());
            expect(isUrlFieldInvalid).eq('true');
            expect(isTokenFieldInvalid).eq('false');
        });

        it('Check Token field error after click test', async function () {
            await urlField?.sendKeys(LOCAL_SERVER_FULL_URL);
            await tokenField?.sendKeys(TEST_BROKEN_PAT_TOKEN);
            await testConnectionButton?.click();

            await new Promise((res) => setTimeout(res, 500));

            const isTokenFieldInvalid = await tokenField
                ?.getDriver()
                .wait(async () => Until.getAttribute(tokenField, 'invalid', 'true'), 5000);
            const isUrlFieldInvalid = await urlField?.getAttribute('invalid');
            console.log(await webview.getDriver().takeScreenshot());
            expect(isUrlFieldInvalid).eq('false');
            expect(isTokenFieldInvalid).eq('true');
        });
    });
});
