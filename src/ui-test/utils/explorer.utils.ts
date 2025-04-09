import * as fs from 'fs';
import { ActivityBar, SideBarView, ViewSection, VSBrowser } from 'vscode-extension-tester';

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
    console.log(await VSBrowser.instance.driver.takeScreenshot());
    const item = await section.findItem(fileName);
    console.log(await VSBrowser.instance.driver.takeScreenshot());
    await item?.click();
    console.log(await VSBrowser.instance.driver.takeScreenshot());
};

export const deleteFile = (path: string): void => {
    if (fs.existsSync(path)) {
        fs.unlinkSync(path);
    }
};
