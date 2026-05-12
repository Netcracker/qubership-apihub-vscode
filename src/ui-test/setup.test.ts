import { VSBrowser, ViewControl } from 'vscode-extension-tester';

const originalOpenView = ViewControl.prototype.openView;
ViewControl.prototype.openView = async function () {
    try {
        const driver = VSBrowser.instance.driver;
        await driver.executeScript(`
            const overlay = document.querySelector('.onboarding-a-overlay');
            if (overlay) { overlay.remove(); }
        `);
    } catch {
        // ignore
    }
    return originalOpenView.call(this);
};
