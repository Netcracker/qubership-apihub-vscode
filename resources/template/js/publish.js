// @ts-check

(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    const PublishFields = {
        PACKAGE_ID: 'packageId',
        VERSION: 'version',
        STATUS: 'status',
        PREVIOUS_VERSION: 'previousVersion',
        LABELS: 'labels',
        PUBLISH_BUTTON: 'publish-button'
    };

    const PublishWebviewMessages = {
        PUBLISH: 'publish',
        UPDATE_OPTIONS: 'updateOptions',
        UPDATE_FIELD: 'updateField',
        UPDATE_PATTERN: 'updatePattern',
        REQUEST_VERSIONS: 'requestVersions'
    };

    const packageId = document.querySelector(`#${PublishFields.PACKAGE_ID}`);
    const version = document.querySelector(`#${PublishFields.VERSION}`);
    const status = document.querySelector(`#${PublishFields.STATUS}`);
    const previousVersion = document.querySelector(`#${PublishFields.PREVIOUS_VERSION}`);
    const labels = document.querySelector(`#${PublishFields.LABELS}`);
    const publishButton = document.querySelector(`#${PublishFields.PUBLISH_BUTTON}`);

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
        labels.addEventListener('input', () => sendFieldValue(PublishFields.LABELS, labels));
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

    window.addEventListener('message', (event) => {
        const message = event.data;
        const payload = message.payload;
        switch (message.command) {
            case PublishWebviewMessages.UPDATE_FIELD: {
                updateField(payload.field, payload.value);
                break;
            }
            case PublishWebviewMessages.UPDATE_OPTIONS: {
                updateOptions(payload.field, payload.value);
                break;
            }
            case PublishWebviewMessages.UPDATE_PATTERN: {
                updatePettern(payload.field, payload.value);
                break;
            }
        }
    });

    function updatePettern(fieldName, value) {
        const field = document.querySelector(`#${fieldName}`);
        if (!field) {
            return;
        }
        field?.setAttribute('pattern', value);
        field?.setAttribute('placeholder', value);
        // @ts-ignore
        field?.reportValidity();
    }

    function updateOptions(fieldName, values) {
        const field = document.querySelector(`#${fieldName}`);
        if (!field) {
            return;
        }
        // @ts-ignore
        field.innerHTML = null;
        values?.forEach((element) => {
            var opt = document.createElement('vscode-option');
            opt.value = element;
            opt.innerHTML = element;
            field?.appendChild(opt);
        });
    }

    function updateField(fieldName, value) {
        const field = document.querySelector(`#${fieldName}`);
        if (!field) {
            return;
        }
        switch (fieldName) {
            case PublishFields.PACKAGE_ID:
            case PublishFields.VERSION:
            case PublishFields.LABELS: {
                // @ts-ignore
                const input = field.shadowRoot.querySelector('input');
                if (!input) {
                    return;
                }
                // @ts-ignore
                input.value = value;
                break;
            }
            case PublishFields.PREVIOUS_VERSION:
            case PublishFields.STATUS: {
                // @ts-ignore
                field.selectedIndex = field.options.findIndex((option) => option.value === value);
                break;
            }
            case PublishFields.PUBLISH_BUTTON: {
                // @ts-ignore
                publishButton.disabled = value === 'true';
                break;
            }
        }
    }

    function sendFieldValue(fieldName, field) {
        if (!fieldName || !field) {
            return;
        }
        const value = field.value?.trim();
        vscode.postMessage({
            command: PublishWebviewMessages.UPDATE_FIELD,
            payload: {
                field: fieldName,
                value
            }
        });
    }

    function requestVersions() {
        vscode.postMessage({
            command: PublishWebviewMessages.REQUEST_VERSIONS
        });
    }

    function publish() {
        // @ts-ignore
        const packageIdValue = packageId?.shadowRoot.querySelector('input').value?.trim() ?? '';
        if (!packageIdValue) {
            // @ts-ignore
            packageId.required = true;
            return;
        }

        // @ts-ignore
        const versionValue = version?.shadowRoot.querySelector('input').value?.trim() ?? '';
        if (!versionValue) {
            // @ts-ignore
            version.required = true;
            return;
        }
        // @ts-ignore
        const statusValue = status?.value?.trim() ?? '';
        // @ts-ignore
        const previousVersionValue = previousVersion?.value?.trim() ?? '';
        if (!previousVersionValue) {
            // @ts-ignore
            previousVersion.required = true;
            return;
        }
        // @ts-ignore
        const labelsValue = labels?.shadowRoot.querySelector('input').value?.trim() ?? '';

        vscode.postMessage({
            command: PublishWebviewMessages.PUBLISH,
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
