import { Router } from 'express';
import {
    PublishConfig,
    PublishStatus,
    PublishStatusDto,
    PublishVersionDto,
    PublishViewPackageIdData
} from '../../src/common/models/publish.model';
import { PACKAGE_ID_NAME, PACKAGES_DATA } from '../data/packages';
import { VERSIONS } from '../data/versions';

export type PackageRouter = Router;

export function PackageRouter(): PackageRouter {
    const router = Router();

    getVersions(router);
    getPackageIdData(router);
    postPublish(router);
    getPublishStatus(router);

    return router;
}

export function getVersions(router: PackageRouter): void {
    router.get('/:packageId/versions/', (req, res) => {
        const packageId = req.params.packageId;
        res.status(200).json(packageId === PACKAGE_ID_NAME ? ({ versions: VERSIONS } as PublishVersionDto) : []);
    });
}

export function getPackageIdData(router: PackageRouter): void {
    router.get('/:packageId/', (req, res) => {
        const packageId = req.params.packageId;
        const packageIdData: PublishViewPackageIdData | undefined = PACKAGES_DATA.find(
            (data) => data.packageId === packageId
        );
        if (packageIdData) {
            res.status(200).json(packageIdData as PublishViewPackageIdData);
            return;
        }
        res.status(404).json();
    });
}

export function postPublish(router: PackageRouter): void {
    router.post('/:packageId/publish/', (req, res) => {
        const packageId = req.params.packageId;

        setTimeout(() => res.status(200).json({ config: {}, publishId: packageId } as PublishConfig), 500);
    });
}

export function getPublishStatus(router: PackageRouter): void {
    router.get('/:packageId/publish/:publishId/status/', (req, res) => {
        setTimeout(
            () =>
                res
                    .status(200)
                    .json({ message: '', publishId: '', status: PublishStatus.COMPLETE } as PublishStatusDto),
            500
        );
    });
}
