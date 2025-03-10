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

    const packageId = document.querySelector(`#${PublishFields.PACKAGE_ID}`);
    const version = document.querySelector(`#${PublishFields.VERSION}`);
    const status = document.querySelector(`#${PublishFields.STATUS}`);
    const previousVersion = document.querySelector(`#${PublishFields.PREVIOUS_VERSION}`);
    const labels = document.querySelector(`#${PublishFields.LABELS}`);
    const publishButton = document.querySelector(`#${PublishFields.PUBLISH_BUTTON}`);

    fieldMapper.set(PublishFields.PACKAGE_ID, { type: FieldTypes.INPUT, field: packageId });
    fieldMapper.set(PublishFields.VERSION, { type: FieldTypes.INPUT, field: version });
    fieldMapper.set(PublishFields.STATUS, { type: FieldTypes.SINGLE_SELECT, field: status });
    fieldMapper.set(PublishFields.PREVIOUS_VERSION, { type: FieldTypes.SINGLE_SELECT, field: previousVersion });
    fieldMapper.set(PublishFields.LABELS, { type: FieldTypes.LABELS, field: labels });
    fieldMapper.set(PublishFields.PUBLISH_BUTTON, { type: FieldTypes.BUTTON, field: publishButton });

    if (packageId) {
        fieldListenersMapper.get(FieldTypes.INPUT)(PublishFields.PACKAGE_ID, packageId);
    }
    if (version) {
        fieldListenersMapper.get(FieldTypes.INPUT)(PublishFields.VERSION, version);
    }
    if (status) {
        status.addEventListener('change', () => sendFieldValue(PublishFields.STATUS, status));
    }
    if (labels) {
        // @ts-ignore
        labels.addEventListener('focusout', () => {
            updateLables();
        });
        // @ts-ignore
        labels.addEventListener('keyup', ({ key }) => {
            if (key === 'Enter') {
                updateLables();
            }
        });
    }
    if (previousVersion) {
        fieldListenersMapper.get(FieldTypes.SINGLE_SELECT)(PublishFields.PREVIOUS_VERSION, previousVersion);
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

    function publish() {
        vscode.postMessage({
            command: 'publish'
        });
    }
})();
