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
import { WorkfolderPath } from './common/models/common.model';
import { SpecificationItem } from './common/models/specification-item';
import { ConfigurationFileService } from './common/services/configuration-file.service';
import { ItemCheckboxService } from './common/services/Item-checkbox.service';
import { PublishService } from './common/services/publish.service';
import { SecretStorageService } from './common/services/secret-storage.service';
import { WorkspaceService } from './common/services/workspace.service';
import { EnvironmentViewProvider } from './common/webview/environment-view';
import { PublishViewProvider } from './common/webview/publish-view';
import { SpecificationFileTreeProvider } from './specification-tree/specification-tree-provider';

export function activate(context: ExtensionContext): void {
    const workspaceFolders: WorkfolderPath[] = workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
    const secretStorageService = new SecretStorageService(context);
    const workspaceFolderService = new WorkspaceService(workspaceFolders);
    context.subscriptions.push(workspaceFolderService);
    const itemCheckboxService = new ItemCheckboxService();
    const configurationFileService = new ConfigurationFileService(workspaceFolders);

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
            const workspace = workspaceFolderService.activeWorkspace;
            items.forEach(([item, checked]) =>
                checked === TreeItemCheckboxState.Checked
                    ? itemCheckboxService.add(workspace, item.uri.fsPath)
                    : itemCheckboxService.delete(workspace, item.uri.fsPath)
            );
        })
    );

    context.subscriptions.push(
        commands.registerCommand(EXTENSION_EXPLORER_CLEAN_ACTION_NAME, () => {
            itemCheckboxService.clear(workspaceFolderService.activeWorkspace);
            fileTreeProvider.refresh();
        })
    );

    context.subscriptions.push(
        commands.registerCommand(
            EXTENSION_EXPLORER_OPEN_FILE_ACTION_NAME,
            async (resource: Uri) => await window.showTextDocument(resource, { viewColumn: ViewColumn.One })
        )
    );

    const publishViewProvider = new PublishViewProvider(
        context,
        workspaceFolders,
        secretStorageService,
        configurationFileService,
        workspaceFolderService
    );
    context.subscriptions.push(window.registerWebviewViewProvider(EXTENSION_PUBLISH_VIEW_NAME, publishViewProvider));

    const environmentViewProvider = new EnvironmentViewProvider(context, secretStorageService);
    context.subscriptions.push(
        window.registerWebviewViewProvider(EXTENSION_ENVIRONMENT_VIEW_NAME, environmentViewProvider)
    );

    const publishService = new PublishService(
        publishViewProvider,
        fileTreeProvider,
        secretStorageService,
        configurationFileService
    );
    context.subscriptions.push(publishService);
}

export function deactivate() {}
