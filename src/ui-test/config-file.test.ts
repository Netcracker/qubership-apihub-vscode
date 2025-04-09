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
import { delay } from './utils/common.utils';
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
        deleteConfigFiles();
    });

    after(async function () {
        await resetWorkspace();
    });

    describe('Publish', function () {
        let webview: WebView;

        before(async function () {
            await setupPublishView();
        });

        after(async function () {
            await cleanupPublishView();
        });

        it('Check: Get Package Id from Config file', async function () {
            await webview.switchToFrame();

            await findPublishFields();

            await clearTextField(packageIdField);
            await packageIdField?.sendKeys(PACKAGE_ID_NAME);

            writeConfigFile(CONFIG_FILE_1_PATH, CONFIG_FILE_3);
            await delay(2000);

            await findPublishFields();
            const textValue = await getTextValue(packageIdField);
            await webview.switchBack();
            expect(textValue).is.equals(PACKAGE_ID_RELEASE_NAME);
        });

        const findPublishFields = async (): Promise<void> => {
            const textFields = await webview.findWebElements(TEXT_FIELD_LOCATOR);
            packageIdField = await findWebElementById(textFields, PublishFields.PACKAGE_ID);
        };

        const cleanupPublishView = async (): Promise<void> => {
            await webview?.switchBack();
            await expandAll(sections);
        };

        const setupPublishView = async (): Promise<void> => {
            viewControl = await new ActivityBar().getViewControl(EXTENSION_NAME);
            sideBar = await viewControl?.openView();
            sections = await sideBar?.getContent().getSections();
            webview = await getWebView(sideBar, PLUGIN_SECTIONS.PUBLISH);
        };
    });

    describe('Tree', function () {
        let treeSection: CustomTreeSection | undefined;
        let items: CustomTreeItem[];

        before(async function () {
            await setupTreeView();
        });

        afterEach(async function () {
            await resetTreeView();
        });

        after(async function () {
            await cleanupTreeView();
        });

        it('Check: Get checkboxes from Config File', async function () {
            await validateTreeContent(WORKSPACE_1_CONTENT);

            writeConfigFile(CONFIG_FILE_1_PATH, CONFIG_FILE_3);
            await delay(500);
            await validateTreeContent(WORKSPACE_2_CONTENT);
        });

        it('Check: Get none api spec files from Config File', async function () {
            await validateTreeContent(WORKSPACE_1_CONTENT);

            writeConfigFile(CONFIG_FILE_1_PATH, CONFIG_FILE_5);
            await delay(1000);
            await validateTreeContent(WORKSPACE_3_CONTENT);
        });

        describe('Two workspaces content', function () {
            before(async function () {
                await VSBrowser.instance.openResources(WORKSPACE_1_PATH, WORKSPACE_2_PATH);
                await delay(1000);
            });

            it('Check: Config Files in two workspaces', async function () {
                writeConfigFile(CONFIG_FILE_1_PATH, CONFIG_FILE_3);
                writeConfigFile(CONFIG_FILE_2_PATH, CONFIG_FILE_6);
                await delay(1000);

                await openFileFromExplorer(CONFIG_FILE_NAME);
                await validateTreeContent(WORKSPACE_2_CONTENT);

                await openFileFromExplorer(CARS_NAME);
                await validateTreeContent(WORKSPACE_4_CONTENT);
            });
        });

        const setupTreeView = async (): Promise<void> => {
            await getTreeSection();
            items = ((await treeSection?.getVisibleItems()) as CustomTreeItem[]) ?? [];
            await toggleCheckboxes(items);
            await delay(1000);
        };

        const resetTreeView = async (): Promise<void> => {
            await getTreeSection();
            items = ((await treeSection?.getVisibleItems()) as CustomTreeItem[]) ?? [];
            await toggleCheckboxes(items);
            await delay(1000);
        };

        const validateTreeContent = async (expectedContent: TestTreeItem[]): Promise<void> => {
            await getTreeSection();
            const data = await checkItemCheckboxes(treeSection);
            expect(data).to.deep.equal(expectedContent);
        };

        const getTreeSection = async (): Promise<void> => {
            viewControl = await new ActivityBar().getViewControl(EXTENSION_NAME);
            sideBar = await viewControl?.openView();
            sections = await sideBar?.getContent().getSections();
            treeSection = (await sideBar?.getContent().getSection(DOCUMENTS_SECTION)) as CustomTreeSection;
        };
        const cleanupTreeView = async (): Promise<void> => {
            await getTreeSection();
            await expandAll(sections);
        };
    });

    const toggleCheckboxes = async (items: CustomTreeItem[]): Promise<void> => {
        await Promise.all(items.map(async (item) => await selectCheckbox(item)));
    };

    const writeConfigFile = (path: string, content: string): void => {
        fs.writeFileSync(path, content, 'utf8');
    };

    const deleteConfigFiles = (): void => {
        deleteFile(CONFIG_FILE_1_PATH);
        deleteFile(CONFIG_FILE_2_PATH);
    };

    const resetWorkspace = async (): Promise<void> => {
        await VSBrowser.instance.openResources(WORKSPACE_EMPTY_PATH);
        await delay(1000);
        await closeSaveWorkspaceDialog();
        await delay(2000);
    };
});
