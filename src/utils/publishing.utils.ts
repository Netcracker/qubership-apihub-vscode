import { VersionStatus } from '../common/models/publishing.model';
import { WebviewOption } from '../common/models/webview.model';


export const getPreviousVersionStatuses = (status: VersionStatus): VersionStatus[] =>
    status === VersionStatus.DRAFT ? [VersionStatus.RELEASE, VersionStatus.DRAFT] : [VersionStatus.RELEASE];

export const hasSamePreviousVersionScope = (one: VersionStatus, another: VersionStatus): boolean =>
    (one === VersionStatus.DRAFT) === (another === VersionStatus.DRAFT);

export const convertOptionsToDto = (
    options: string[],
    selected: string,
    labels?: Record<string, string>
): WebviewOption[] => {
    return (
        options.map((option) => {
            const label = labels?.[option];
            return {
                name: option,
                disabled: false,
                selected: selected ? option === selected : false,
                ...(label ? { label } : {})
            };
        }) ?? []
    );
};
