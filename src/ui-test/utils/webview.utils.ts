import {
    By,
    Key,
    ModalDialog,
    SideBarView,
    until,
    ViewSection,
    VSBrowser,
    WebElement,
    WebView
} from 'vscode-extension-tester';
import { LabelData } from '../models/label.model';
import { PLUGIN_SECTIONS } from '../constants/test.constants';
import { DISABLED_ATTRIBUTE, REQUIRED_ATTRIBUTE } from '../constants/attribute.constants';

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

export const getWebView = async (sideBar: SideBarView | undefined, sectionName: PLUGIN_SECTIONS): Promise<WebView> => {
    const sections = (await sideBar?.getContent().getSections()) ?? [];
    for (const section of sections) {
        const title = await section.getTitle();
        if (title === sectionName) {
            break;
        } else {
            try {
                await section.collapse();
            } catch {}
        }
    }
    const section = await sideBar?.getContent().getSection(sectionName);
    const webviewElem = await section?.getDriver().wait(until.elementLocated(By.css('iframe')), 1000);
    return new WebView(webviewElem);
};

// export const collapseAll = async (sections: ViewSection[])

export const expandAll = async (sections: ViewSection[]): Promise<void> => {
    for (const section of sections) {
        try {
            await section.expand();

            console.log();
        } catch {}
    }
};
export const collapseAll = async (sections: ViewSection[]): Promise<void> => {
    for (const section of sections) {
        try {
            await section.collapse();
        } catch {}
    }
};

export const getLabels = async (data: WebElement[]): Promise<LabelData[]> => {
    return Promise.all(
        data.map(async (labelData) => {
            return {
                label: await labelData.getText(),
                required: (await labelData.getAttribute(REQUIRED_ATTRIBUTE)) === 'true'
            } as LabelData;
        })
    );
};

export const clearTextField = async (field: WebElement | undefined): Promise<void> => {
    await field?.sendKeys(Key.CONTROL + 'a', Key.BACK_SPACE);
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

    static getDisabledAttribute = async (field: WebElement | undefined, value: string): Promise<string | null> => {
        const attributeValue = await field?.getAttribute(DISABLED_ATTRIBUTE);
        return attributeValue === value ? attributeValue : null;
    };

    static isNotAttribute = async (field: WebElement | undefined, attribute: string): Promise<boolean> => {
        const attributeValue = await field?.getAttribute(attribute);
        return !attributeValue;
    };
}
