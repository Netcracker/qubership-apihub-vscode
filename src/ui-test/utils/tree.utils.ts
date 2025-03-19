import { ActivityBar, By, CustomTreeItem, SideBarView, until, ViewSection } from 'vscode-extension-tester';
import { TestTreeItem } from '../models/tree.model';

export const openExplorer = async (): Promise<ViewSection> => {
    const activityBar = new ActivityBar();
    const explorer = await activityBar.getViewControl('Explorer');
    await explorer?.openView();
    const sideBar = new SideBarView();
    const section = await sideBar.getContent().getSections();
    return section[0];
};

export const openFileFromExplorer = async (fileName: string): Promise<void> => {
    const section = await openExplorer();
    const item = await section.findItem(fileName);
    await item?.click();
};

export const getCheckboxState = async (item: CustomTreeItem): Promise<boolean> => {
    const checkbox = await item.findElement(By.className('custom-view-tree-node-item-checkbox'));
    return (await checkbox.getAttribute('aria-checked')) === 'true';
};

export const clickCheckbox = async (item: CustomTreeItem): Promise<void> => {
    const checkbox = await item.findElement(By.className('custom-view-tree-node-item-checkbox'));
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
