import { By, CustomTreeItem, WebElement } from 'vscode-extension-tester';
import { TestTreeItem } from '../models/tree.model';

const getCheckbox = async (item: CustomTreeItem): Promise<WebElement> => {
    return item.findElement(By.className('custom-view-tree-node-item-checkbox'));
};

export const getCheckboxState = async (item: CustomTreeItem): Promise<boolean> => {
    const checkbox = await getCheckbox(item);
    return (await checkbox.getAttribute('aria-checked')) === 'true';
};

export const clickCheckbox = async (item: CustomTreeItem): Promise<void> => {
    const checkbox = await getCheckbox(item);
    return checkbox.click();
};

export const getTestTreeItems = async (items: CustomTreeItem[]): Promise<TestTreeItem[]> =>
    Promise.all(
        items.map(async (item) => {
            const checkbox = await getCheckboxState(item);
            const description = await item.getDescription();
            const label = await item.getLabel();
            return {
                checkbox,
                description,
                label
            } as TestTreeItem;
        })
    );
