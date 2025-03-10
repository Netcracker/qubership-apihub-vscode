import { WebviewOption } from '../common/models/webview.model';

export const convertOptionsToDto = (options: string[]): WebviewOption[] => {
    return options.map((option) => ({ name: option, disabled: false })) ?? [];
};
