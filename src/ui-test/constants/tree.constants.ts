import * as path from 'path';

export const DOCUMENTS_WELCOME_TEXT =
    'No documents found for publication. Please read the manual to solve the problem.';
export const PETS_NAME = 'pets.yaml';
export const CARS_NAME = 'cars.yaml';
export const CHECKBOX_CARS_NAME = 'checkbox-cars.yaml';

export const WORKSPACE_1_NAME = 'workspace1';
export const WORKSPACE_2_NAME = 'workspace2';
export const WORKSPACE_3_NAME = 'workspace3';
export const UNITED_WORKSPACE = 'Untitled (Workspace)';

export const CONFIG_FILE_NAME = '.apihub-config.yaml';

export const WORKSPACE_1_PATH = path.join('src', 'ui-test', 'resources', WORKSPACE_1_NAME);
export const WORKSPACE_2_PATH = path.join('src', 'ui-test', 'resources', WORKSPACE_2_NAME);
export const WORKSPACE_3_PATH = path.join('src', 'ui-test', 'resources', WORKSPACE_3_NAME);
export const CONFIG_FILE_1_PATH = path.join(WORKSPACE_1_PATH, CONFIG_FILE_NAME);
export const CONFIG_FILE_2_PATH = path.join(WORKSPACE_2_PATH, CONFIG_FILE_NAME);
