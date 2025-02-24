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
        REQUEST_VERSIONS: 'requestVersions',
        DELETE: 'delete'
    };

    const LABELS_ID = 'labelForLables';
    const LABELS_PLACEHOLDER = 'pulbish-labels-placeholder';

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
        labels.addEventListener("focusout", (event) => {
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

    function updateLables(){
        if(!labels){
            return;
        }
        const shadowRoot= labels.shadowRoot;
        if(!shadowRoot){
            return;
        }
        const input = shadowRoot.querySelector('input');
        if(!input){
            return;
        }
        if(!input.value?.trim()?.length){
            return;
        }
        sendFieldValue(PublishFields.LABELS, labels);
        // @ts-ignore
        input.value = '';
    }

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
            var optio = document.createElement('vscode-option');
            optio.value = element;
            optio.innerHTML = element;
            field.appendChild(optio);
        });
    }

    function updateField(fieldName, value) {
        const field = document.querySelector(`#${fieldName}`);
        if (!field) {
            return;
        }
        switch (fieldName) {
            case PublishFields.PACKAGE_ID:
            case PublishFields.VERSION: {
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
            case PublishFields.LABELS: {
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

    function deleteFieldValue(fieldName, value) {
        if (!fieldName || !value) {
            return;
        }
        vscode.postMessage({
            command: PublishWebviewMessages.DELETE,
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

    function getInput(field){
        if(!field){
            return;
        }
        const shadowRoot = field.shadowRoot;
        if(!shadowRoot){
            return;
        }
        return shadowRoot.querySelector('input');
    }

    function publish() {
        const packageIdValue = getInput(packageId).value?.trim() ?? '';
        if (!packageIdValue) {
            // @ts-ignore
            packageId.required = true;
            return;
        }

        const versionValue = getInput(version).value?.trim() ?? '';
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

        let labelsValue = [];
        const labels = document.querySelector(`#${LABELS_PLACEHOLDER}`);
        if(labels){
            labelsValue = Array.from(labels.children).map(chip=> chip.innerHTML);
        }

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
