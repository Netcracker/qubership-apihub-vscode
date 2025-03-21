import { expect } from 'chai';
import { ActivityBar, By, SideBarView, ViewControl, ViewSection, WebElement, WebView } from 'vscode-extension-tester';
import { PublishFields } from '../common/models/publish.model';
import { EXTENTSION_NAME, PUBLISH_SECTION } from './constants/test.constants';
import { LabelData } from './models/label.model';
import { expandAll, findWebElementById, getWebView } from './utils/webview.utils';

const LABELS_DATA: LabelData[] = [
    { label: 'Package Id:', required: true },
    { label: 'Version:', required: true },
    { label: 'Status:', required: true },
    { label: 'Labels:', required: false },
    { label: 'Previous release version:', required: true }
];

describe('Publsih Test', () => {
    let sections: ViewSection[];
    let webview: WebView;
    let packageIdField: WebElement | undefined;
    let versionField: WebElement | undefined;
    let statusField: WebElement | undefined;
    let labelsField: WebElement | undefined;
    let previousReleaseVersion: WebElement | undefined;

    before(async () => {
        const viewControl: ViewControl | undefined = await new ActivityBar().getViewControl(EXTENTSION_NAME);
        const sideBar: SideBarView | undefined = await viewControl?.openView();
        if (!sideBar) {
            return;
        }
        sections = await sideBar.getContent().getSections();
        webview = await getWebView(sideBar, PUBLISH_SECTION);
        await webview.switchToFrame();

        const textFields = await webview.findWebElements(By.css('vscode-textfield'));
        const selectFields = await webview.findWebElements(By.css('vscode-single-select'));
        packageIdField = await findWebElementById(textFields, PublishFields.PACKAGE_ID);
        versionField = await findWebElementById(textFields, PublishFields.VERSION);
        statusField = await findWebElementById(selectFields, PublishFields.STATUS);
        labelsField = await findWebElementById(textFields, PublishFields.LABELS);
        previousReleaseVersion = await findWebElementById(selectFields, PublishFields.PREVIOUS_VERSION);
    });

    after(async () => {
        await webview.switchBack();
        await expandAll(sections ?? []);
    });

    it('Check labels required', async () => {
        const vsLabels = await webview.findWebElements(By.css('vscode-label'));
        const labels: LabelData[] = await Promise.all(
            vsLabels.map(async (labelData) => {
                return {
                    label: await labelData.getText(),
                    required: (await labelData.getAttribute('required')) === 'true'
                } as LabelData;
            })
        );
        expect(labels).to.deep.equal(LABELS_DATA);
    });
});
