import { WebviewOption } from '../common/models/webview.model';

export const convertOptionsToDto = (options: string[], selected: string): WebviewOption[] => {
    return (
        options.map((option) => ({
            name: option,
            disabled: false,
            selected: selected ? option === selected : false
        })) ?? []
    );
};
