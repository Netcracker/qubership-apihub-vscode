import * as assert from 'assert';
import { PUBLISH_LOADING_OPTION } from '../../common/constants/publish.constants';
import {
    capitalize,
    getExtension,
    getFileDirectory,
    getMiddlePath,
    isApispecFile,
    isItemApispecFile,
    sortStrings
} from '../../utils/path.utils';
import { convertOptionsToDto } from '../../utils/publish.utils';
import { SpecificationItem } from '../../common/models/specification-item';
import { Uri } from 'vscode';

const OPTION_1 = 'option1';
const OPTION_2 = 'option2';

const NAME_1 = 'name_1';
const NAME_CAPITALIZED_1 = 'Name_1';

const YAML = 'yaml';
const YML = 'yml';
const JSON = 'json';
const DOC = 'doc';
const GQL = 'gql';
const GRAPHQ = 'graphql';

const WORKFOLDER_PATH = 'disk:\\folder-name\\workfolder';

suite('Utils', () => {
    test('convertOptionsToDto', async () => {
        let optionsDto = convertOptionsToDto([OPTION_1]);
        assert.deepStrictEqual(optionsDto, [{ name: OPTION_1, disabled: false }]);

        optionsDto = convertOptionsToDto([OPTION_1, OPTION_2]);
        assert.deepStrictEqual(optionsDto, [
            { name: OPTION_1, disabled: false },
            { name: OPTION_2, disabled: false }
        ]);

        optionsDto = convertOptionsToDto([PUBLISH_LOADING_OPTION]);
        assert.deepStrictEqual(optionsDto, [{ name: PUBLISH_LOADING_OPTION, disabled: true }]);

        optionsDto = convertOptionsToDto([OPTION_1, PUBLISH_LOADING_OPTION]);
        assert.deepStrictEqual(optionsDto, [
            { name: OPTION_1, disabled: false },
            { name: PUBLISH_LOADING_OPTION, disabled: true }
        ]);
    });

    test('getMiddlePath', async () => {
        const src = 'src';
        const docs = 'docs';
        const middlePath = getMiddlePath(WORKFOLDER_PATH, `${WORKFOLDER_PATH}\\${src}\\${docs}\\${NAME_1}.${YAML}`);
        assert.equal(middlePath, `/${src}/${docs}/`);
    });

    test('getFileDirectory', async () => {
        const aa = getFileDirectory('d:\\work\\test-apihub\\src\\docs\\cars.yaml');
        assert.equal(aa, 'd:\\work\\test-apihub\\src\\docs\\');
    });

    test('capitalize', async () => {
        assert.equal(capitalize(NAME_1), NAME_CAPITALIZED_1);
        assert.equal(capitalize(NAME_CAPITALIZED_1), NAME_CAPITALIZED_1);
    });

    test('getExtension', async () => {
        assert.equal(getExtension(`${NAME_1}.${YAML}`), YAML);
        assert.equal(getExtension(`${NAME_1}.${YML}`), YML);
        assert.equal(getExtension(`${NAME_1}.${JSON}`), JSON);
        assert.equal(getExtension(`${NAME_1}.${DOC}`), DOC);
    });

    test('isApispecFile', async () => {
        assert.equal(isApispecFile(YAML), true);
        assert.equal(isApispecFile(YML), true);
        assert.equal(isApispecFile(JSON), true);
        assert.equal(isApispecFile(DOC), false);
        assert.equal(isApispecFile(GQL), false);
        assert.equal(isApispecFile(GRAPHQ), false);
    });

    test('isItemApispecFile', async () => {
        const item1: SpecificationItem = {
            label: NAME_1,
            parentPath: '',
            uri: Uri.file(`${NAME_1}.${YAML}`),
            workspacePath: '',
            checkboxState: 0
        };
        assert.equal(isItemApispecFile(item1), true);

        const item2: SpecificationItem = {
            label: NAME_1,
            parentPath: '',
            uri: Uri.file(`${NAME_1}.${GRAPHQ}`),
            workspacePath: '',
            checkboxState: 0
        };
        assert.equal(isItemApispecFile(item2), false);
    });

    test('sortStrings', async () => {
        assert.deepStrictEqual(sortStrings(['b', 'a', 'c']), ['a', 'b', 'c']);
    });
});
