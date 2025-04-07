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

    typeFieldMapper.set(PublishFields.PACKAGE_ID, FieldTypes.INPUT);
    typeFieldMapper.set(PublishFields.VERSION, FieldTypes.INPUT);
    typeFieldMapper.set(PublishFields.STATUS, FieldTypes.SINGLE_SELECT);
    typeFieldMapper.set(PublishFields.PREVIOUS_VERSION, FieldTypes.SINGLE_SELECT_COMBOBOX);
    typeFieldMapper.set(PublishFields.LABELS, FieldTypes.LABELS);
    typeFieldMapper.set(PublishFields.PUBLISH_BUTTON, FieldTypes.BUTTON);

    defaultListenersMapper.get(typeFieldMapper.get(PublishFields.PACKAGE_ID))(PublishFields.PACKAGE_ID);
    defaultListenersMapper.get(typeFieldMapper.get(PublishFields.VERSION))(PublishFields.VERSION);
    defaultListenersMapper.get(typeFieldMapper.get(PublishFields.STATUS))(PublishFields.STATUS);
    defaultListenersMapper.get(typeFieldMapper.get(PublishFields.PREVIOUS_VERSION))(PublishFields.PREVIOUS_VERSION);

    const labels = document.querySelector(`#${PublishFields.LABELS}`);
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

    const publishButton = document.querySelector(`#${PublishFields.PUBLISH_BUTTON}`);
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
        sendFieldValue(PublishFields.LABELS);
        // @ts-ignore
        input.value = '';
    }

    function publish() {
        vscode.postMessage({
            command: 'publish'
        });
    }
})();
