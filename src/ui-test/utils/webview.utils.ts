import { ModalDialog, VSBrowser, WebElement } from 'vscode-extension-tester';

export const findWebElementById = async (items: WebElement[], name: string): Promise<WebElement | undefined> => {
    for await (const item of items) {
        const nameAttribute = await item.getAttribute('id');
        if (nameAttribute === name) {
            return item;
        }
    }
    return undefined;
};

export const closeSaveWorkspaceDialog = async (): Promise<void> => {
    const browser = VSBrowser.instance;
    const driver = browser.driver;

    await driver.wait(async () => {
        try {
            const dialog = new ModalDialog();
            const buttons = await dialog.getButtons();

            for (const button of buttons) {
                const label = await button.getText();
                if (label === "Don't Save") {
                    await button.click();
                    return true;
                }
            }
        } catch (error) {
            return false;
        }
    }, 5000);
};
