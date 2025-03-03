import {
    commands,
    ExtensionContext,
    TreeCheckboxChangeEvent,
    TreeItemCheckboxState,
    TreeViewVisibilityChangeEvent,
    Uri,
    ViewColumn,
    window,
    workspace
} from 'vscode';
import {
    EXTENSION_ENVIRONMENT_VIEW_NAME,
    EXTENSION_EXPLORER_CLEAN_ACTION_NAME,
    EXTENSION_EXPLORER_NAME,
    EXTENSION_EXPLORER_OPEN_FILE_ACTION_NAME,
    EXTENSION_PUBLISH_VIEW_NAME
} from './common/constants/common.constants';
import { CrudService } from './common/cruds/crud.service';
import { WorkfolderPath } from './common/models/common.model';
import { SpecificationItem } from './common/models/specification-item';
import { ConfigurationFileService } from './common/services/configuration-file.service';
import { ConfigurationService } from './common/services/configuration.service';
import { ItemCheckboxService } from './common/services/Item-checkbox.service';
import { PublishService } from './common/services/publish.service';
import { WorkspaceService } from './common/services/workspace.service';
import { EnvironmentViewProvider } from './common/webview/environment-view';
import { PublishViewProvider } from './common/webview/publish-view';
import { SpecificationFileTreeProvider } from './specification-tree/specification-tree-provider';

export function activate(context: ExtensionContext): void {
    const workspaceFolders: WorkfolderPath[] = workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
    const workspaceFolderService = new WorkspaceService(workspaceFolders);
    context.subscriptions.push(workspaceFolderService);
    const itemCheckboxService = new ItemCheckboxService();
    const configurationService = new ConfigurationService(context);
    const configurationFileService = new ConfigurationFileService(workspaceFolders);
    context.subscriptions.push(configurationFileService);

    const fileTreeProvider = new SpecificationFileTreeProvider(
        workspaceFolderService,
        itemCheckboxService,
        configurationFileService
    );
    const apihubTreeView = window.createTreeView(EXTENSION_EXPLORER_NAME, {
        treeDataProvider: fileTreeProvider
    });
    context.subscriptions.push(apihubTreeView);

    context.subscriptions.push(
        apihubTreeView.onDidChangeVisibility((event: TreeViewVisibilityChangeEvent) =>
            fileTreeProvider.activate(event.visible)
        )
    );

    context.subscriptions.push(
        apihubTreeView.onDidChangeCheckboxState(({ items }: TreeCheckboxChangeEvent<SpecificationItem>) => {
            const workspace = workspaceFolderService.activeWorkfolderPath;
            items.forEach(([item, checked]) =>
                checked === TreeItemCheckboxState.Checked
                    ? itemCheckboxService.add(workspace, item.uri.fsPath)
                    : itemCheckboxService.delete(workspace, item.uri.fsPath)
            );
        })
    );

    context.subscriptions.push(
        commands.registerCommand(EXTENSION_EXPLORER_CLEAN_ACTION_NAME, () => {
            itemCheckboxService.clear(workspaceFolderService.activeWorkfolderPath);
            fileTreeProvider.refresh();
        })
    );

    context.subscriptions.push(
        commands.registerCommand(
            EXTENSION_EXPLORER_OPEN_FILE_ACTION_NAME,
            async (resource: Uri) => await window.showTextDocument(resource, { viewColumn: ViewColumn.One })
        )
    );
    const crudService: CrudService = new CrudService();
    context.subscriptions.push(crudService);

    const publishService = new PublishService(
        fileTreeProvider,
        configurationService,
        configurationFileService
    );
    context.subscriptions.push(publishService);

    const publishViewProvider = new PublishViewProvider(
        context,
        crudService,
        workspaceFolders,
        configurationService,
        configurationFileService,
        workspaceFolderService,
        publishService
    );
    context.subscriptions.push(window.registerWebviewViewProvider(EXTENSION_PUBLISH_VIEW_NAME, publishViewProvider));

    const environmentViewProvider = new EnvironmentViewProvider(context, crudService, configurationService);
    context.subscriptions.push(
        window.registerWebviewViewProvider(EXTENSION_ENVIRONMENT_VIEW_NAME, environmentViewProvider)
    );
}

export function deactivate() {}
