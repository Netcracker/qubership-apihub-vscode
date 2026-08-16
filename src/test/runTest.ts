import * as path from 'path';

import { runTests } from '@vscode/test-electron';

// Kept in step with the `--code_version` passed to `extest` in the `test:ui` script, and within the
// `vscode-min`/`vscode-max` range that vscode-extension-tester declares. Without a pin, every run
// resolves to whatever stable release is current, so a VS Code release can break CI on its own and
// the download cache key changes weekly.
const VSCODE_VERSION = '1.131.0';

// Idle timeout for the VS Code download. The default of 15 s aborts a ~300 MB transfer on the first
// stall on a CI runner, and the built-in retries restart the file from scratch under the same limit.
const DOWNLOAD_TIMEOUT_MS = 120_000;

async function main(): Promise<void> {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to the extension test script
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		// Download VS Code, unzip it and run the integration test
		await runTests({
			version: VSCODE_VERSION,
			timeout: DOWNLOAD_TIMEOUT_MS,
			extensionDevelopmentPath,
			extensionTestsPath,
		});
	} catch (error) {
		console.error('Failed to run tests');
		console.error(error);
		process.exit(1);
	}
}

main();
