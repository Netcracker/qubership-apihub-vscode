// @ts-check

(function () {
    const PublishingFields = {
        PACKAGE_ID: 'packageId',
        VERSION: 'version',
        STATUS: 'status',
        PREVIOUS_VERSION: 'previousVersion',
        LABELS: 'labels',
        PUBLISH_BUTTON: 'publish-button'
    };

    typeFieldMapper.set(PublishingFields.PACKAGE_ID, FieldTypes.INPUT);
    typeFieldMapper.set(PublishingFields.VERSION, FieldTypes.INPUT);
    typeFieldMapper.set(PublishingFields.STATUS, FieldTypes.SINGLE_SELECT);
    typeFieldMapper.set(PublishingFields.PREVIOUS_VERSION, FieldTypes.SINGLE_SELECT_COMBOBOX);
    typeFieldMapper.set(PublishingFields.LABELS, FieldTypes.LABELS);
    typeFieldMapper.set(PublishingFields.PUBLISH_BUTTON, FieldTypes.BUTTON);

    defaultListenersMapper.get(typeFieldMapper.get(PublishingFields.PACKAGE_ID))(PublishingFields.PACKAGE_ID);
    defaultListenersMapper.get(typeFieldMapper.get(PublishingFields.VERSION))(PublishingFields.VERSION);
    defaultListenersMapper.get(typeFieldMapper.get(PublishingFields.STATUS))(PublishingFields.STATUS);
    defaultListenersMapper.get(typeFieldMapper.get(PublishingFields.PREVIOUS_VERSION))(PublishingFields.PREVIOUS_VERSION);

    const labels = document.querySelector(`#${PublishingFields.LABELS}`);
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

    const publishButton = document.querySelector(`#${PublishingFields.PUBLISH_BUTTON}`);
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
        sendFieldValue(PublishingFields.LABELS);
        // @ts-ignore
        input.value = '';
    }

    function publish() {
        vscode.postMessage({
            command: 'publish'
        });
    }
})();
