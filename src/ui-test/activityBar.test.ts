import { expect } from 'chai';
import { ActivityBar } from 'vscode-extension-tester';

describe('Activity Bar Tests', () => {
	let activityBar: ActivityBar;

	before(async () => {
		activityBar = new ActivityBar();
	});

	it('Shows Qubership APIHUB', async () => {
		const controls = await activityBar.getViewControls();
		expect(controls).not.empty;

		const titles = await Promise.all(
			controls.map(async (control) => {
				return control.getTitle();
			}),
		);
		expect(titles.some((title) => title.startsWith('Qubership APIHUB'))).is.true;
	});


	it('Get a view Qubership APIHUB', async () => {
		const ctrl = await activityBar.getViewControl('Qubership APIHUB');
		const view = await ctrl?.openView();
		expect(view).is.not.undefined;
		expect(await view?.isDisplayed()).is.true;
	});
});
