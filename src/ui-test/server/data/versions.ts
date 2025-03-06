import { PublishVersion } from '../../../common/models/publish.model';

export const VERSION_LABEL = 'DRAFT';

export const VERSIONS: PublishVersion[] = [
    {
        version: '2025.2@1',
        status: 'draft',
        createdAt: '2025-03-11T10:49:08.291543Z',
        createdBy: {
            avatarUrl: '',
            email: 'userEmail',
            id: 'userId',
            name: 'userName',
            type: 'user'
        },
        versionLabels: [VERSION_LABEL],
        previousVersion: '2025.1@1'
    },
    {
        version: '2025.1@1',
        status: 'release',
        createdAt: '2025-03-11T10:38:41.00982Z',
        createdBy: {
            avatarUrl: '',
            email: 'userEmail',
            id: 'userId',
            name: 'userName',
            type: 'user'
        },
        versionLabels: [],
        previousVersion: ''
    }
];
