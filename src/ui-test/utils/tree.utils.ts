import { ActivityBar, By, CustomTreeItem, SideBarView, until } from 'vscode-extension-tester';
import { TestTreeItem } from '../models/tree.model';

export const openFileFromExplorer = async (fileName: string): Promise<void> => {
    const activityBar = new ActivityBar();
    const explorer = await activityBar.getViewControl('Explorer');
    await explorer?.openView();

    const sideBar = new SideBarView();
    const section = await sideBar.getContent().getSections();
    const item = await section[0].findItem(fileName);
    await item?.click();
};

export const getCheckboxState = async (item: CustomTreeItem): Promise<boolean> => {
    console.log("item: ", await item.getText());
    const checkbox = await item.getDriver().wait(until.elementLocated(By.className('custom-view-tree-node-item-checkbox')), 5000);
    console.log("checkbox: ", await checkbox.getText());
    return (await checkbox.getAttribute('aria-checked')) === 'true';
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
