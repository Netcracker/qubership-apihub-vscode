import { expect } from 'chai';
import {
    ActivityBar,
    CustomTreeItem,
    CustomTreeSection,
    SideBarView,
    ViewControl,
    VSBrowser,
    WelcomeContentSection
} from 'vscode-extension-tester';
import { DOCUMENTS_SECTION, EXTENTSION_NAME } from './constants/test.constants';
import {
    CARS_NAME,
    CHECKBOX_CARS_NAME,
    DOCUMENTS_WELCOME_TEXT,
    PETS_NAME,
    UNITED_WORKSPACE,
    WORKSPACE_1_NAME,
    WORKSPACE_1_PATH,
    WORKSPACE_2_PATH,
    WORKSPACE_3_PATH
} from './constants/tree.constants';
import { TestTreeItem } from './models/tree.model';
import { openExplorer, openFileFromExplorer } from './utils/explorer.utils';
import { clickCheckbox, getTestTreeItems } from './utils/tree.utils';
import { collapseAll, expandAll, findAsync } from './utils/webview.utils';

const WORKSPACE_1_CONTENT: TestTreeItem[] = [
    { checkbox: true, description: '/src/docs/', label: PETS_NAME },
    { checkbox: true, description: '/src/docs/', label: 'store.yaml' },
    { checkbox: true, description: '/src/docs/', label: 'testGql.gql' },
    { checkbox: true, description: '/src/docs/', label: 'testGraphql.graphql' },
    { checkbox: true, description: '/src/docs/', label: 'user.yaml' },
    { checkbox: true, description: '/src/docs/gql/', label: 'testGql.gql' }
];

const WORKSPACE_2_CONTENT: TestTreeItem[] = [
    { checkbox: true, description: '', label: CARS_NAME },
    { checkbox: true, description: '/docs/', label: 'a-cars.yaml' },
    { checkbox: true, description: '/docs/', label: 'b-cars.yaml' },
    { checkbox: true, description: '/docs/', label: 'c-cars.yaml' },
    { checkbox: true, description: '/docs/', label: CARS_NAME },
    { checkbox: true, description: '/docs/car/', label: CARS_NAME },
    { checkbox: true, description: '/docs/car/', label: CHECKBOX_CARS_NAME }
];

const WORKSPACE_1_CHECKBOX_CONTENT: TestTreeItem[] = [
    { checkbox: false, description: '/src/docs/', label: PETS_NAME },
    { checkbox: true, description: '/src/docs/', label: 'store.yaml' },
    { checkbox: true, description: '/src/docs/', label: 'testGql.gql' },
    { checkbox: true, description: '/src/docs/', label: 'testGraphql.graphql' },
    { checkbox: true, description: '/src/docs/', label: 'user.yaml' },
    { checkbox: true, description: '/src/docs/gql/', label: 'testGql.gql' }
];

const WORKSPACE_2_CHECKBOX_CONTENT: TestTreeItem[] = [
    { checkbox: true, description: '', label: CARS_NAME },
    { checkbox: true, description: '/docs/', label: 'a-cars.yaml' },
    { checkbox: true, description: '/docs/', label: 'b-cars.yaml' },
    { checkbox: true, description: '/docs/', label: 'c-cars.yaml' },
    { checkbox: true, description: '/docs/', label: CARS_NAME },
    { checkbox: true, description: '/docs/car/', label: CARS_NAME },
    { checkbox: false, description: '/docs/car/', label: CHECKBOX_CARS_NAME }
];

describe('Specification tree view tests', () => {
    let viewControl: ViewControl | undefined;
    let treeSection: CustomTreeSection;
    let sideBar: SideBarView | undefined;

    const getTreeSection = async (): Promise<void> => {
        viewControl = await new ActivityBar().getViewControl(EXTENTSION_NAME);
        sideBar = await viewControl?.openView();
        if (!sideBar) {
            throw new Error(`Sidebar not found`);
        }
        treeSection = await sideBar.getContent().getSection(DOCUMENTS_SECTION);
    };

    const checkSavedCheckboxContext = async (
        fileName: string,
        content: TestTreeItem[],
        workspaceName: string
    ): Promise<void> => {
        await openFileFromExplorer(fileName);
        await getTreeSection();

        const items: CustomTreeItem[] = ((await treeSection.getVisibleItems()) as CustomTreeItem[]) ?? [];
        const item = await findAsync(items, async (item) => (await item.getLabel()) === fileName);
        if (!item) {
            throw new Error(`${fileName} not found`);
        }
        await clickCheckbox(item);
        let testTreeItems: TestTreeItem[] = await getTestTreeItems(items);
        expect(testTreeItems).to.deep.equal(content);

        // Swith to Explorer
        const section = await openExplorer();
        const title = await section.getTitle();
        expect(title).is.eq(workspaceName);

        // Back to plugin and check checkboxes
        await getTreeSection();
        testTreeItems = await getTestTreeItems(items);
        expect(testTreeItems).to.deep.equal(content);
    };

    const checkItemCheckboxes = async (content: TestTreeItem[]): Promise<void> => {
        const items: CustomTreeItem[] = ((await treeSection.getVisibleItems()) as CustomTreeItem[]) ?? [];
        const testTreeItems: TestTreeItem[] = await getTestTreeItems(items);

        expect(testTreeItems).to.deep.equal(content);
    };

    before(async () => {
        await VSBrowser.instance.openResources(WORKSPACE_3_PATH);
        await getTreeSection();
    });

    it('Welcome content', async () => {
        const welcomeContentSection: WelcomeContentSection | undefined = await treeSection.findWelcomeContent();
        const welcomeContent: string = (await welcomeContentSection?.getText()) ?? '';
        expect(welcomeContent).is.eq(DOCUMENTS_WELCOME_TEXT);
    });

    describe('One workspace content', () => {
        before(async () => {
            await VSBrowser.instance.openResources(WORKSPACE_1_PATH);
            await getTreeSection();
        });

        it('Look at the items', async () => {
            await checkItemCheckboxes(WORKSPACE_1_CONTENT);
        });

        it('Expand/collapse DOCUMENTS TO PUBLISH', async () => {
            const sections = await sideBar?.getContent().getSections();
            await collapseAll(sections ?? []);
            await expandAll(sections ?? []);
            await checkItemCheckboxes(WORKSPACE_1_CONTENT);
        });

        it('Checking the status of checkboxes when leaving the plugin', async () => {
            await checkSavedCheckboxContext(PETS_NAME, WORKSPACE_1_CHECKBOX_CONTENT, WORKSPACE_1_NAME);
        });
    });

    describe('Two workspaces content', () => {
        before(async () => {
            await VSBrowser.instance.openResources(WORKSPACE_1_PATH, WORKSPACE_2_PATH);
            await getTreeSection();
        });

        it('Look at the default workspace items', async () => {
            await checkItemCheckboxes(WORKSPACE_1_CONTENT);
        });

        it('Look at the workspace_1 items', async () => {
            await openFileFromExplorer(PETS_NAME);
            await getTreeSection();

            await checkItemCheckboxes(WORKSPACE_1_CONTENT);
        });

        it('Checking the status of workspace_1 checkboxes when leaving the plugin', async () => {
            await checkSavedCheckboxContext(PETS_NAME, WORKSPACE_1_CHECKBOX_CONTENT, UNITED_WORKSPACE);
        });

        it('Look at the workspace_2 items', async () => {
            await openFileFromExplorer(CARS_NAME);
            await getTreeSection();

            await checkItemCheckboxes(WORKSPACE_2_CONTENT);
        });

        it('Checking the status of workspace_2 checkboxes when leaving the plugin', async () => {
            await openFileFromExplorer(CHECKBOX_CARS_NAME);
            await checkSavedCheckboxContext(CHECKBOX_CARS_NAME, WORKSPACE_2_CHECKBOX_CONTENT, UNITED_WORKSPACE);
        });
    });
});
