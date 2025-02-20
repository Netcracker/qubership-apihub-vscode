import { TreeItem, TreeItemCheckboxState, TreeItemCollapsibleState, Uri } from 'vscode';
import { EXTENSION_EXPLORER_OPEN_FILE_ACTION_NAME } from '../constants/common.constants';
import { getMiddlePath } from '../../utils/files.utils';

export class SpecificationItem extends TreeItem {
    constructor(
        public readonly label: string,
        public readonly parentPath: string,
        public readonly uri: Uri,
        public readonly workspacePath: string,
        public readonly checkboxState: TreeItemCheckboxState,
        public readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None
    ) {
        super(uri, collapsibleState);
        this.tooltip = label;
        this.resourceUri = uri;
        this.checkboxState = checkboxState;
        this.description = getMiddlePath(workspacePath, uri.fsPath),
        this.command = {
            command: EXTENSION_EXPLORER_OPEN_FILE_ACTION_NAME,
            title: 'Open Api Specification',
            arguments: [uri]
        };
    }
}
