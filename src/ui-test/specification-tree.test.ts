import { expect } from 'chai';
import * as path from 'path';
import {
    ActivityBar,
    CustomTreeItem,
    CustomTreeSection,
    SideBarView,
    ViewControl,
    VSBrowser,
    WelcomeContentSection
} from 'vscode-extension-tester';
import { TestTreeItem } from './models/tree.model';
import { DOCUMENTS_SECTION, DOCUMENTS_WELCOME_TEXT, EXTENTSION_NAME } from './test.constants';
import { getTestTreeItems, openFileFromExplorer } from './utils/tree.utils';

const WORKSPACE_1 = path.join('ui-test', 'resources', 'workspace1');
const WORKSPACE_2 = path.join('src', 'src', 'ui-test', 'resources', 'workspace2');

const WORKSPACE_1_CONTENT = [
    { checkbox: true, description: '/src/docs/', label: 'pets.yaml' },
    { checkbox: true, description: '/src/docs/', label: 'store.yaml' },
    { checkbox: true, description: '/src/docs/gql/', label: 'testGql.gql' },
    { checkbox: true, description: '/src/docs/', label: 'testGql.gql' },
    { checkbox: true, description: '/src/docs/', label: 'testGraphql.graphql' },
    { checkbox: true, description: '/src/docs/', label: 'user.yaml' }
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

    before(async () => {
        await getTreeSection();
    });

    it('Welcome content', async () => {
        const welcomeContentSection: WelcomeContentSection | undefined = await treeSection.findWelcomeContent();
        const welcomeContent: string = (await welcomeContentSection?.getText()) ?? '';
        expect(welcomeContent).is.eq(DOCUMENTS_WELCOME_TEXT);
    });

    describe('One workspace content', () => {
        before(async function () {
            await VSBrowser.instance.openResources(WORKSPACE_1);
            const browser = VSBrowser.instance;
            const driver = browser.driver;
            let screen = await driver.takeScreenshot();
            console.log(screen);

            await getTreeSection();
        });

        it('Look at the items', async () => {
            const items: CustomTreeItem[] = ((await treeSection.getVisibleItems()) as CustomTreeItem[]) ?? [];
            const testTreeItems: TestTreeItem[] = await getTestTreeItems(items);

            expect(testTreeItems).to.deep.equal(WORKSPACE_1_CONTENT);
        });
    });

    describe('Two workspaces content', () => {
        before(async () => {
            await VSBrowser.instance.openResources(WORKSPACE_1, WORKSPACE_2);
        });

        beforeEach(async () => {
            await getTreeSection();
        });

        after(async () => {
            await VSBrowser.instance.openResources(WORKSPACE_1);
        });

        it('Look at the default workspace items', async () => {
            const items: CustomTreeItem[] = ((await treeSection.getVisibleItems()) as CustomTreeItem[]) ?? [];
            const testTreeItems: TestTreeItem[] = await getTestTreeItems(items);

            expect(testTreeItems).to.deep.equal(WORKSPACE_1_CONTENT);
        });

        it('Look at the workspace_1 items', async () => {
            await openFileFromExplorer('pets.yaml');
            await getTreeSection();

            const items: CustomTreeItem[] = ((await treeSection.getVisibleItems()) as CustomTreeItem[]) ?? [];
            const testTreeItems: TestTreeItem[] = await getTestTreeItems(items);

            expect(testTreeItems).to.deep.equal(WORKSPACE_1_CONTENT);
        });

        it('Look at the workspace_2 items', async () => {
            await openFileFromExplorer('cars.yaml');
            await getTreeSection();

            const items: CustomTreeItem[] = ((await treeSection.getVisibleItems()) as CustomTreeItem[]) ?? [];
            const testTreeItems: TestTreeItem[] = await getTestTreeItems(items);

            expect(testTreeItems).to.deep.equal([
                { checkbox: true, description: '/docs/car/', label: 'cars.yaml' },
                { checkbox: true, description: '/docs/', label: 'cars.yaml' }
            ]);
        });
    });
});
