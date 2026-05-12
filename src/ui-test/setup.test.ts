import { VSBrowser } from 'vscode-extension-tester';

before(async function () {
    this.timeout(15000);
    const driver = VSBrowser.instance.driver;
    await driver.sleep(2000);
    await driver.executeScript(`
        const overlay = document.querySelector('.onboarding-a-overlay');
        if (overlay) { overlay.remove(); }
    `);
    await driver.sleep(500);
});
