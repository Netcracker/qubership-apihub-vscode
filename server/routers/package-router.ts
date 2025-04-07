import { Router } from 'express';
import {
    BuildConfig,
    PublishConfig,
    PublishStatus,
    PublishStatusDto,
    PublishVersionDto,
    PublishViewPackageIdData
} from '../../src/common/models/publish.model';
import { PACKAGE_ID_NAME, PACKAGES_DATA } from '../data/packages';
import { VERSIONS } from '../data/versions';
import multer from 'multer';
import { BUILD_CONFIGS } from '../data/build-config';
import { PUBLISH_ID } from '../data/publish';
import { deepEqualIgnoreOrder as deepEqualBuildConfig } from '../utils/build.utils';

const upload = multer();
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
    router.post('/:packageId/publish/', upload.any(), (req, res) => {
        const packageId = req.params.packageId;
        const buildConfig: BuildConfig | undefined = BUILD_CONFIGS.find((config) => config.packageId === packageId);
        const body = JSON.parse(req.body.config);
        if (deepEqualBuildConfig(buildConfig, body)) {
            setTimeout(
                () => res.status(200).json({ config: buildConfig, publishId: PUBLISH_ID } as PublishConfig),
                500
            );
        } else {
            setTimeout(() => res.status(500).json(), 500);
        }
    });
}

export function getPublishStatus(router: PackageRouter): void {
    router.get('/:packageId/publish/:publishId/status/', (req, res) => {
        const publishId = req.params.publishId;
        if (publishId === PUBLISH_ID) {
            setTimeout(
                () =>
                    res
                        .status(200)
                        .json({ message: '', publishId: '', status: PublishStatus.COMPLETE } as PublishStatusDto),
                500
            );
        } else {
            setTimeout(() => res.status(500).json(), 500);
        }
    });
}
