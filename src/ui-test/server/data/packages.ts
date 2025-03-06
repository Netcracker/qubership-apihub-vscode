import { PublishViewPackageIdData } from '../../../common/models/publish.model';

export const PACKAGE_ID_NAME = 'packageId';
export const RELEASE_VERSION_PATTERN = '^[0-9]{4}[.]{1}[1-4]{1}$';

export const PACKAGES_DATA: PublishViewPackageIdData[] = [
    {
        alias: "id",
        defaultReleaseVersion: '',
        defaultRole: 'viewer',
        defaultVersion: '3000.1',
        description: '',
        excludeFromSearch: false,
        imageUrl: '',
        isFavorite: false,
        kind: 'package',
        name: 'packageIdFullName',
        packageId: PACKAGE_ID_NAME,
        parentId: '1',
        parents: [],
        permissions: [
            'read'
        ],
        releaseVersionPattern: RELEASE_VERSION_PATTERN
    }
];
