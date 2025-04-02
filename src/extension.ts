import path from 'path';
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
    EXTENSION_PUBLISH_VIEW_NAME,
    SHOW_READMI_ACTION_NAME
} from './common/constants/common.constants';
import { CrudService } from './common/cruds/crud.service';
import { WorkfolderPath } from './common/models/common.model';
import { SpecificationItem } from './common/models/specification-item';
import { ConfigurationFileService } from './common/services/configuration-file.service';
import { ItemCheckboxService } from './common/services/Item-checkbox.service';
import { PublishService } from './common/services/publish.service';
import { WorkspaceService } from './common/services/workspace.service';
import { EnvironmentViewProvider } from './common/webview/environment-view';
import { PublishViewProvider } from './common/webview/publish-view';
import { SpecificationFileTreeProvider } from './specification-tree/specification-tree-provider';
import { SecretStorageService } from './common/services/secret-storage.service';
import { getWorkspaceFolders } from './utils/path.utils';

export function activate(context: ExtensionContext): void {
    const workspaceFolders = getWorkspaceFolders();

    const workspaceFolderService = new WorkspaceService(workspaceFolders);
    context.subscriptions.push(workspaceFolderService);

    const itemCheckboxService = new ItemCheckboxService();

    const secretStorageService = new SecretStorageService(context);

    const configurationFileService = new ConfigurationFileService(workspaceFolders);
    context.subscriptions.push(configurationFileService);

    context.subscriptions.push(workspace.onDidChangeWorkspaceFolders(()=> {
        const workspaceFolders = getWorkspaceFolders();
        configurationFileService.initWorkfolderPaths(workspaceFolders);
        workspaceFolderService.updateWorkfolderPaths(workspaceFolders);
    }));

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

    context.subscriptions.push(
        commands.registerCommand(SHOW_READMI_ACTION_NAME, (fragment: string) => {
            const readmeUri = Uri.file(path.join(context.extensionPath, 'README.md')).with({ fragment });
            commands.executeCommand('markdown.showPreview', readmeUri);
        })
    );

    const crudService: CrudService = new CrudService();
    context.subscriptions.push(crudService);

    const publishService = new PublishService(fileTreeProvider, secretStorageService, configurationFileService);
    context.subscriptions.push(publishService);

    const publishViewProvider = new PublishViewProvider(
        context,
        crudService,
        workspaceFolders,
        secretStorageService,
        configurationFileService,
        workspaceFolderService,
        publishService
    );
    context.subscriptions.push(window.registerWebviewViewProvider(EXTENSION_PUBLISH_VIEW_NAME, publishViewProvider));

    const environmentViewProvider = new EnvironmentViewProvider(context, crudService, secretStorageService);
    context.subscriptions.push(
        window.registerWebviewViewProvider(EXTENSION_ENVIRONMENT_VIEW_NAME, environmentViewProvider)
    );
}

export function deactivate() {}
