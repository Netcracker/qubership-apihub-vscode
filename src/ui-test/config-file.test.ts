import { expect } from 'chai';
import * as fs from 'fs';
import {
    ActivityBar,
    CustomTreeItem,
    CustomTreeSection,
    SideBarView,
    ViewControl,
    ViewSection,
    VSBrowser,
    WebElement,
    WebView
} from 'vscode-extension-tester';
import { PublishFields } from '../common/models/publish.model';
import { CONFIG_FILE_3, CONFIG_FILE_5, CONFIG_FILE_6 } from './constants/publish.constants';
import {
    DOCUMENTS_SECTION,
    EXTENSION_NAME,
    PACKAGE_ID_NAME,
    PACKAGE_ID_RELEASE_NAME,
    PLUGIN_SECTIONS
} from './constants/test.constants';
import {
    CARS_NAME,
    CONFIG_FILE_1_PATH,
    CONFIG_FILE_2_PATH,
    CONFIG_FILE_NAME,
    PETS_NAME,
    WORKSPACE_1_PATH,
    WORKSPACE_2_PATH,
    WORKSPACE_EMPTY_PATH
} from './constants/tree.constants';
import { TestTreeItem } from './models/tree.model';
import { TEXT_FIELD_LOCATOR } from './models/webview.model';
import { deleteFile, openFileFromExplorer } from './utils/explorer.utils';
import { checkItemCheckboxes, selectCheckbox } from './utils/tree.utils';
import {
    clearTextField,
    closeSaveWorkspaceDialog,
    expandAll,
    findWebElementById,
    getTextValue,
    getWebView
} from './utils/webview.utils';

const WORKSPACE_1_CONTENT: TestTreeItem[] = [
    { checkbox: true, description: '/src/docs/', label: PETS_NAME },
    { checkbox: true, description: '/src/docs/', label: 'store.yaml' },
    { checkbox: true, description: '/src/docs/', label: 'testGql.gql' },
    { checkbox: true, description: '/src/docs/', label: 'testGraphql.graphql' },
    { checkbox: true, description: '/src/docs/', label: 'user.yaml' },
    { checkbox: true, description: '/src/docs/gql/', label: 'testGql.gql' }
];

const WORKSPACE_2_CONTENT: TestTreeItem[] = [
    { checkbox: false, description: '/src/docs/', label: PETS_NAME },
    { checkbox: true, description: '/src/docs/', label: 'store.yaml' },
    { checkbox: false, description: '/src/docs/', label: 'testGql.gql' },
    { checkbox: false, description: '/src/docs/', label: 'testGraphql.graphql' },
    { checkbox: false, description: '/src/docs/', label: 'user.yaml' },
    { checkbox: false, description: '/src/docs/gql/', label: 'testGql.gql' }
];

const WORKSPACE_3_CONTENT: TestTreeItem[] = [
    { checkbox: true, description: '/src/docs/', label: 'info.docx' },
    { checkbox: false, description: '/src/docs/', label: PETS_NAME },
    { checkbox: true, description: '/src/docs/', label: 'store.yaml' },
    { checkbox: false, description: '/src/docs/', label: 'testGql.gql' },
    { checkbox: false, description: '/src/docs/', label: 'testGraphql.graphql' },
    { checkbox: false, description: '/src/docs/', label: 'user.yaml' },
    { checkbox: false, description: '/src/docs/gql/', label: 'testGql.gql' }
];

const WORKSPACE_4_CONTENT: TestTreeItem[] = [
    { checkbox: true, description: '', label: CARS_NAME },
    { checkbox: false, description: '/docs/', label: 'a-cars.yaml' },
    { checkbox: false, description: '/docs/', label: 'b-cars.yaml' },
    { checkbox: false, description: '/docs/', label: 'c-cars.yaml' },
    { checkbox: false, description: '/docs/', label: CARS_NAME },
    { checkbox: false, description: '/docs/car/', label: CARS_NAME },
    { checkbox: false, description: '/docs/car/', label: 'checkbox-cars.yaml' }
];

describe('Config File', () => {
    let viewControl: ViewControl | undefined;
    let packageIdField: WebElement | undefined;
    let sideBar: SideBarView | undefined;
    let sections: ViewSection[] | undefined;

    before(async function () {
        await VSBrowser.instance.openResources(WORKSPACE_1_PATH);
    });

    afterEach(async function () {
        deleteConfigFile();
    });

    after(async function () {
        await VSBrowser.instance.openResources(WORKSPACE_EMPTY_PATH);
        await new Promise((res) => setTimeout(res, 1000));

        await closeSaveWorkspaceDialog();

        await new Promise((res) => setTimeout(res, 2000));
    });

    describe('Publish', function () {
        let webview: WebView;
        before(async function () {
            viewControl = await new ActivityBar().getViewControl(EXTENSION_NAME);
            sideBar = await viewControl?.openView();
            sections = await sideBar?.getContent().getSections();
            webview = await getWebView(sideBar, PLUGIN_SECTIONS.PUBLISH);
        });

        after(async function () {
            await webview?.switchBack();
            await expandAll(sections);
        });

        it('Check: Get Package Id from Config file', async function () {
            await webview.switchToFrame();

            await findPublishFields();

            await clearTextField(packageIdField);
            await packageIdField?.sendKeys(PACKAGE_ID_NAME);

            fs.writeFileSync(CONFIG_FILE_1_PATH, CONFIG_FILE_3, 'utf8');
            await new Promise((res) => setTimeout(res, 2000));

            await findPublishFields();
            const textValue = await getTextValue(packageIdField);
            await webview.switchBack();
            expect(textValue).is.equals(PACKAGE_ID_RELEASE_NAME);
        });

        const findPublishFields = async (): Promise<void> => {
            const textFields = await webview.findWebElements(TEXT_FIELD_LOCATOR);
            packageIdField = await findWebElementById(textFields, PublishFields.PACKAGE_ID);
        };
    });

    describe('Tree', function () {
        let treeSection: CustomTreeSection | undefined;
        let items: CustomTreeItem[];

        const getTreeSection = async (): Promise<void> => {
            viewControl = await new ActivityBar().getViewControl(EXTENSION_NAME);
            sideBar = await viewControl?.openView();
            sections = await sideBar?.getContent().getSections();
            treeSection = (await sideBar?.getContent().getSection(DOCUMENTS_SECTION)) as CustomTreeSection;
        };

        before(async function () {
            await getTreeSection();
            items = ((await treeSection?.getVisibleItems()) as CustomTreeItem[]) ?? [];
            await Promise.all(items.map(async (item) => await selectCheckbox(item)));
            await new Promise((res) => setTimeout(res, 1000));
        });

        afterEach(async function () {
            await getTreeSection();
            items = ((await treeSection?.getVisibleItems()) as CustomTreeItem[]) ?? [];
            await Promise.all(items.map(async (item) => await selectCheckbox(item)));
            await new Promise((res) => setTimeout(res, 1000));
        });

        after(async function () {
            await getTreeSection();
            await expandAll(sections);    
        });

        it('Check: Get checkboxes from Config File', async function () {
            await getTreeSection();

            let data = await checkItemCheckboxes(treeSection);
            expect(data).to.deep.equal(WORKSPACE_1_CONTENT);

            fs.writeFileSync(CONFIG_FILE_1_PATH, CONFIG_FILE_3, 'utf8');
            await new Promise((res) => setTimeout(res, 500));
            data = await checkItemCheckboxes(treeSection);
            expect(data).to.deep.equal(WORKSPACE_2_CONTENT);
        });

        it('Check: Get none api spec files from Config File', async function () {
            await getTreeSection();
            await new Promise((res) => setTimeout(res, 1000));

            let data = await checkItemCheckboxes(treeSection);
            expect(data).to.deep.equal(WORKSPACE_1_CONTENT);

            fs.writeFileSync(CONFIG_FILE_1_PATH, CONFIG_FILE_5, 'utf8');
            await new Promise((res) => setTimeout(res, 1000));
            data = await checkItemCheckboxes(treeSection);
            expect(data).to.deep.equal(WORKSPACE_3_CONTENT);
        });

        describe('Two workspaces content', function () {
            before(async function () {
                await VSBrowser.instance.openResources(WORKSPACE_1_PATH, WORKSPACE_2_PATH);
                await new Promise((res) => setTimeout(res, 1000));
            });

            it('Check: Config Files in two workspaces', async function () {
                await getTreeSection();
                await new Promise((res) => setTimeout(res, 1000));

                fs.writeFileSync(CONFIG_FILE_1_PATH, CONFIG_FILE_3, 'utf8');
                await new Promise((res) => setTimeout(res, 1000));
                fs.writeFileSync(CONFIG_FILE_2_PATH, CONFIG_FILE_6, 'utf8');

                await new Promise((res) => setTimeout(res, 1000));
                await openFileFromExplorer(CONFIG_FILE_NAME);

                await getTreeSection();
                await new Promise((res) => setTimeout(res, 1000));
                let data = await checkItemCheckboxes(treeSection);
                expect(data).to.deep.equal(WORKSPACE_2_CONTENT);
                await openFileFromExplorer(CARS_NAME);
                await getTreeSection();
                data = await checkItemCheckboxes(treeSection);
                expect(data).to.deep.equal(WORKSPACE_4_CONTENT);
            });
        });
    });

    const deleteConfigFile = (): void => {
        deleteFile(CONFIG_FILE_1_PATH);
        deleteFile(CONFIG_FILE_2_PATH);
    };
});
