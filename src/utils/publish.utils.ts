import { PUBLISH_LOADING_OPTION } from '../common/constants/publish.constants';
import { WebviewOption } from '../common/models/webview.model';

export const convertOptionsToDto = (options: string[]): WebviewOption[] => {
    return options.map((option) => ({ name: option, disabled: PUBLISH_LOADING_OPTION === option })) ?? [];
};
