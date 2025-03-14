import { expect } from 'chai';
import { ActivityBar } from 'vscode-extension-tester';
import { EXTENTSION_NAME } from './test.constants';

describe('Activity Bar Tests', () => {
	let activityBar: ActivityBar;

	before(async () => {
		activityBar = new ActivityBar();
	});

	it('Show extension', async () => {
		const controls = await activityBar.getViewControls();
		expect(controls).not.empty;

		const titles = await Promise.all(
			controls.map(async (control) => {
				return control.getTitle();
			}),
		);
		expect(titles.some((title) => title === EXTENTSION_NAME)).is.true;
	});

	it('Get a extension view', async () => {
		const viewControl = await activityBar.getViewControl(EXTENTSION_NAME);
		const view = await viewControl?.openView();
		expect(view).is.not.undefined;
		expect(await view?.isDisplayed()).is.true;
	});
});
