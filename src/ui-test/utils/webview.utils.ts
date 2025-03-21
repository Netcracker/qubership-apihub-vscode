import {
    By,
    ModalDialog,
    SideBarView,
    until,
    ViewSection,
    VSBrowser,
    WebElement,
    WebView
} from 'vscode-extension-tester';

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

export const getWebView = async (sideBar: SideBarView, sectionName: string): Promise<WebView> => {
    const sections = await sideBar.getContent().getSections();
    for (const section of sections) {
        const title = await section.getTitle();
        if (title !== sectionName) {
            try {
                await section.collapse();
            } catch {}
        }
    }
    const section = await sideBar.getContent().getSection(sectionName);
    const webviewElem = await section.getDriver().wait(until.elementLocated(By.css('iframe')), 1000);
    return new WebView(webviewElem);
};

export const expandAll = async (sections: ViewSection[]): Promise<void> => {
    for (const section of sections) {
        try {
            await section.expand();

            console.log();
        } catch {}
    }
};

export class Until {
    static getAttribute = async (
        field: WebElement | undefined,
        attribute: string,
        value: string
    ): Promise<string | null> => {
        const attributeValue = await field?.getAttribute(attribute);
        return attributeValue === value ? attributeValue : null;
    };
}
