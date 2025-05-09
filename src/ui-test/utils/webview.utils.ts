import { By, Key, ModalDialog, SideBarView, ViewSection, WebElement, WebviewView } from 'vscode-extension-tester';
import { DISABLED_ATTRIBUTE, REQUIRED_ATTRIBUTE } from '../constants/attribute.constants';
import { PLUGIN_SECTIONS } from '../constants/test.constants';
import { LabelData } from '../models/label.model';

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
    try {
        const dialog = new ModalDialog();
        const buttons = await dialog.getButtons();

        for (const button of buttons) {
            const label = await button.getText();
            if (label === "Don't Save") {
                await button.click();
            }
        }
    } catch {}
};

export const getWebView = async (
    sideBar: SideBarView | undefined,
    sectionName: PLUGIN_SECTIONS
): Promise<WebviewView | undefined> => {
    const section = await sideBar?.getContent().getSection(sectionName);
    if (!section) {
        throw new Error(`Section "${sectionName}" not found.`);
    }
    return new WebviewView(section);
};

export const expandAll = async (sections: ViewSection[] | undefined): Promise<void> => {
    if (!sections) {
        return;
    }
    for (const section of sections) {
        try {
            await section.expand();
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

export const getFieldLabels = async (data: WebElement[]): Promise<LabelData[]> => {
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
    await field?.sendKeys(Key.END);
    await field?.sendKeys(Key.SHIFT + Key.HOME);
    await field?.sendKeys(Key.BACK_SPACE);
};

export const getSingleSelectOptions = async (field: WebElement | undefined): Promise<WebElement[]> => {
    const shadowRoot = await field?.getShadowRoot();
    const options = (await shadowRoot?.findElements(By.className('option'))) ?? [];
    return options;
};

export const clickOption = async (field: WebElement | undefined, name: string): Promise<void> => {
    await field?.click();
    const options = await getSingleSelectOptions(field);
    const option = await findAsync(options, async (option) => (await option.getText()) === name);
    if (!option) {
        return field?.click();
    }
    await option?.click();
};

export const findAsync = async <T>(array: T[], predicate: (item: T) => Promise<boolean>): Promise<T | undefined> => {
    for (const item of array) {
        if (await predicate(item)) {
            return item;
        }
    }
    return undefined;
};

export const getPatternMismatch = async (field: WebElement | undefined): Promise<boolean> => {
    return field?.getDriver().executeScript('return arguments[0].validity.patternMismatch;', field) ?? false;
};

export const getTexts = async (fields: WebElement[]): Promise<string[]> => {
    return Promise.all(fields.map(async (field) => await field.getText()));
};

export const getTextValue = async (field: WebElement | undefined): Promise<string | undefined> => {
    const shadowRoot = await field?.getShadowRoot();
    const textField = await shadowRoot?.findElement(By.css('input'));
    return textField?.getAttribute('value');
};

export const openSelect = async (field: WebElement | undefined): Promise<void> => {
    const isOpened = await field?.getAttribute('open');
    if (!isOpened) {
        await field?.click();
    }
};

export const closeSelect = async (field: WebElement | undefined): Promise<void> => {
    const isOpened = await field?.getAttribute('open');
    if (isOpened) {
        await field?.click();
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

    static getDisabledAttribute = async (field: WebElement | undefined, value: string): Promise<string | null> => {
        const attributeValue = await field?.getAttribute(DISABLED_ATTRIBUTE);
        return attributeValue === value ? attributeValue : null;
    };

    static isNotAttribute = async (field: WebElement | undefined, attribute: string): Promise<boolean> => {
        const attributeValue = await field?.getAttribute(attribute);
        return !attributeValue;
    };
}
