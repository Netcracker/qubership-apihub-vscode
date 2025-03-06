import path from 'path';
import {
    commands,
    ExtensionContext,
    TreeCheckboxChangeEvent,
    TreeItemCheckboxState,
    TreeViewVisibilityChangeEvent,
    Uri,
    ViewColumn,
    window
} from 'vscode';
import {
    EXTENSION_ENVIRONMENT_VIEW_NAME,
    EXTENSION_EXPLORER_NAME,
    EXTENSION_EXPLORER_OPEN_FILE_ACTION_NAME,
    EXTENSION_PUBLISH_VIEW_NAME,
    SHOW_README_ACTION_NAME
} from './common/constants/common.constants';
import { CrudService } from './common/cruds/crud.service';
import { SpecificationItem } from './common/models/specification-item';
import { ConfigurationFileService } from './common/services/configuration-file.service';
import { EnvironmentStorageService } from './common/services/environment-storage.service';
import { ItemCheckboxService } from './common/services/Item-checkbox.service';
import { PublishService } from './common/services/publish.service';
import { WorkspaceService } from './common/services/workspace.service';
import { EnvironmentViewProvider } from './common/webview/environment-view';
import { PublishViewProvider } from './common/webview/publish-view';
import { SpecificationFileTreeProvider } from './specification-tree/specification-tree-provider';

export function activate(context: ExtensionContext): void {
    const workspaceFolderService = new WorkspaceService();
    context.subscriptions.push(workspaceFolderService);

    const itemCheckboxService = new ItemCheckboxService();
    const environmentStorageService = new EnvironmentStorageService(context);

    const configurationFileService = new ConfigurationFileService();
    context.subscriptions.push(configurationFileService);

    const fileTreeProvider = new SpecificationFileTreeProvider(
        workspaceFolderService,
        itemCheckboxService,
        configurationFileService
    );
    const treeView = window.createTreeView(EXTENSION_EXPLORER_NAME, {
        treeDataProvider: fileTreeProvider
    });
    context.subscriptions.push(treeView);

    context.subscriptions.push(
        treeView.onDidChangeVisibility((event: TreeViewVisibilityChangeEvent) =>
            fileTreeProvider.activate(event.visible)
        )
    );

    context.subscriptions.push(
        treeView.onDidChangeCheckboxState(({ items }: TreeCheckboxChangeEvent<SpecificationItem>) => {
            const workspace = workspaceFolderService.activeWorkfolderPath;
            items.forEach(([item, checked]) =>
                checked === TreeItemCheckboxState.Checked
                    ? itemCheckboxService.add(workspace, item.uri.fsPath)
                    : itemCheckboxService.delete(workspace, item.uri.fsPath)
            );
        })
    );

    context.subscriptions.push(
        commands.registerCommand(
            EXTENSION_EXPLORER_OPEN_FILE_ACTION_NAME,
            async (resource: Uri) => await window.showTextDocument(resource, { viewColumn: ViewColumn.One })
        )
    );

    context.subscriptions.push(
        commands.registerCommand(SHOW_README_ACTION_NAME, (fragment: string) => {
            const readmeUri = Uri.file(path.join(context.extensionPath, 'README.md')).with({ fragment });
            commands.executeCommand('markdown.showPreview', readmeUri);
        })
    );

    const crudService: CrudService = new CrudService();
    context.subscriptions.push(crudService);

    const publishService = new PublishService(fileTreeProvider, environmentStorageService, configurationFileService);
    context.subscriptions.push(publishService);

    const publishViewProvider = new PublishViewProvider(
        context,
        crudService,
        environmentStorageService,
        configurationFileService,
        workspaceFolderService,
        publishService
    );
    context.subscriptions.push(window.registerWebviewViewProvider(EXTENSION_PUBLISH_VIEW_NAME, publishViewProvider));

    const environmentViewProvider = new EnvironmentViewProvider(context, crudService, environmentStorageService, publishService);
    context.subscriptions.push(
        window.registerWebviewViewProvider(EXTENSION_ENVIRONMENT_VIEW_NAME, environmentViewProvider)
    );
}

export function deactivate(): void {}
