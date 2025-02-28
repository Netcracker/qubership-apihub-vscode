// @ts-check

(function () {
    const PublishFields = {
        PACKAGE_ID: 'packageId',
        VERSION: 'version',
        STATUS: 'status',
        PREVIOUS_VERSION: 'previousVersion',
        LABELS: 'labels',
        PUBLISH_BUTTON: 'publish-button'
    };

    const LABELS_ID = 'labelForLables';
    const LABELS_PLACEHOLDER = 'pulbish-labels-placeholder';

    const packageId = document.querySelector(`#${PublishFields.PACKAGE_ID}`);
    const version = document.querySelector(`#${PublishFields.VERSION}`);
    const status = document.querySelector(`#${PublishFields.STATUS}`);
    const previousVersion = document.querySelector(`#${PublishFields.PREVIOUS_VERSION}`);
    const labels = document.querySelector(`#${PublishFields.LABELS}`);
    const publishButton = document.querySelector(`#${PublishFields.PUBLISH_BUTTON}`);

    fieldMapper.set(PublishFields.PACKAGE_ID, packageId);
    fieldMapper.set(PublishFields.VERSION, version);
    fieldMapper.set(PublishFields.STATUS, status);
    fieldMapper.set(PublishFields.PREVIOUS_VERSION, previousVersion);
    fieldMapper.set(PublishFields.LABELS, labels);
    fieldMapper.set(PublishFields.PUBLISH_BUTTON, publishButton);

    fieldUpdateMapper.set(PublishFields.PACKAGE_ID, (value) => {
        getInput(packageId).value = value;
    });

    fieldUpdateMapper.set(PublishFields.VERSION, (value) => {
        getInput(version).value = value;
    });

    fieldUpdateMapper.set(PublishFields.PREVIOUS_VERSION, (value) => {
        previousVersion.selectedIndex = previousVersion.options.findIndex((option) => option.value === value);
    });

    fieldUpdateMapper.set(PublishFields.STATUS, (value) => {
        status.selectedIndex = status.options.findIndex((option) => option.value === value);
    });
    fieldUpdateMapper.set(PublishFields.PUBLISH_BUTTON, (value) => {
        publishButton.disabled = value === 'true';
    });
    fieldUpdateMapper.set(PublishFields.LABELS, (value) => {
        const oldLabelPlaceholeder = document.querySelector(`#${LABELS_PLACEHOLDER}`);
        if (oldLabelPlaceholeder) {
            oldLabelPlaceholeder.remove();
        }
        if (!value?.length) {
            return;
        }
        const label = document.querySelector(`#${LABELS_ID}`);
        if (!label) {
            return;
        }
        const placeholder = document.createElement('div');
        placeholder.setAttribute('id', LABELS_PLACEHOLDER);
        placeholder.className = LABELS_PLACEHOLDER;

        label?.append(placeholder);

        value.forEach((label) => {
            const chip = document.createElement('vscode-button');
            chip.setAttribute('icon-after', 'close');
            chip.setAttribute('secondary', '');
            chip.innerHTML = label;
            chip.className = 'publish-chip';
            chip.addEventListener('click', (event) =>
                // @ts-ignore
                deleteFieldValue(PublishFields.LABELS, event?.target?.innerText)
            );
            placeholder.appendChild(chip);
        });
    });

    if (packageId) {
        packageId.addEventListener('input', () => sendFieldValue(PublishFields.PACKAGE_ID, packageId));
    }
    if (version) {
        version.addEventListener('input', () => sendFieldValue(PublishFields.VERSION, version));
    }
    if (status) {
        status.addEventListener('change', () => sendFieldValue(PublishFields.STATUS, status));
    }
    if (labels) {
        labels.addEventListener('focusout', (event) => {
            updateLables();
        });
        labels.addEventListener('keyup', ({ key }) => {
            if (key === 'Enter') {
                updateLables();
            }
        });
    }
    if (previousVersion) {
        previousVersion.addEventListener('click', requestVersions);
        previousVersion.addEventListener('input', () =>
            sendFieldValue(PublishFields.PREVIOUS_VERSION, previousVersion)
        );
    }
    if (publishButton) {
        publishButton.addEventListener('click', publish);
    }

    function updateLables() {
        if (!labels) {
            return;
        }
        const shadowRoot = labels.shadowRoot;
        if (!shadowRoot) {
            return;
        }
        const input = shadowRoot.querySelector('input');
        if (!input) {
            return;
        }
        if (!input.value?.trim()?.length) {
            return;
        }
        sendFieldValue(PublishFields.LABELS, labels);
        // @ts-ignore
        input.value = '';
    }

    function requestVersions() {
        vscode.postMessage({
            command: PublishWebviewMessages.REQUEST_OPTIONS,
            payload: {
                field: PublishFields.VERSION
            }
        });
    }

    function publish() {
        const packageIdValue = getInput(packageId).value?.trim() ?? '';
        const versionValue = getInput(version).value?.trim() ?? '';
        // @ts-ignore
        const statusValue = status?.value?.trim() ?? '';
        // @ts-ignore
        const previousVersionValue = previousVersion?.value?.trim() ?? '';

        let labelsValue = [];
        const labels = document.querySelector(`#${LABELS_PLACEHOLDER}`);
        if (labels) {
            labelsValue = Array.from(labels.children).map((chip) => chip.innerHTML);
        }

        vscode.postMessage({
            command: 'publish',
            payload: {
                packageId: packageIdValue,
                version: versionValue,
                status: statusValue,
                previousVersion: previousVersionValue,
                labels: labelsValue
            }
        });
    }
})();
