// @ts-check
// @ts-ignore
const vscode = acquireVsCodeApi();

const WebviewMessages = {
    UPDATE_OPTIONS: 'updateOptions',
    UPDATE_FIELD: 'updateField',
    UPDATE_PATTERN: 'updatePattern',
    UPDATE_DISABLE: 'updateDisable',
    UPDATE_REQUIRED: 'updateRequired',
    REQUEST_FIELD: 'requestField',
    REQUEST_OPTIONS: 'requestOptions',
    UPDATE_INVALID: 'updateInvalid',
    UPDATE_ICON: 'updateIcon',
    UPDATE_SPIN: 'updateSpin',
    DELETE: 'delete'
};

const FieldTypes = {
    INPUT: 'input',
    SINGLE_SELECT: 'single-select',
    BUTTON: 'button',
    LABELS: 'labels'
};

const DISABLED_ATTRIBUTE = 'disabled';

const fieldMapper = new Map();
const fieldIconMapper = new Map();
const fieldUpdateMapper = new Map();
const fieldListenersMapper = new Map();

const LABELS_ID = 'labelForLables';
const LABELS_PLACEHOLDER = 'pulbish-labels-placeholder';

fieldUpdateMapper.set(FieldTypes.INPUT, (field, value) => {
    getInput(field).value = value;
});

fieldUpdateMapper.set(FieldTypes.SINGLE_SELECT, (field, value) => {
    field.selectedIndex = field.options.findIndex((option) => option.value === value);
});

fieldUpdateMapper.set(FieldTypes.BUTTON, (field, value) => {
    field.disabled = value === 'true';
});

fieldUpdateMapper.set(FieldTypes.LABELS, (field, value, fieldName) => {
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
            deleteFieldValue(fieldName, event?.target?.innerText)
        );
        placeholder.appendChild(chip);
    });
});

fieldListenersMapper.set(FieldTypes.INPUT, (fieldName, field) => {
    field.addEventListener('input', () => sendFieldValue(fieldName, field));
});

fieldListenersMapper.set(FieldTypes.SINGLE_SELECT, (fieldName, field) => {
    field.addEventListener('change', () => sendFieldValue(fieldName, field));
    field.addEventListener('focusout', () => {
        const value = getInput(field).value;
        if (!value?.length) {
            // @ts-ignore
            field.selectedIndex = -1;
            sendFieldValue(fieldName, "");
            updateRequired(fieldName, "true");
            return;
        }
        const index = field.selectedIndex;
        const option = getOptions(fieldName)?.[index];
        if (index === -1 || !option || option.value !== value) {
            sendFieldValue(fieldName, "");
            updateRequired(fieldName, "true");
        }
    });
});

window.addEventListener('message', (event) => {
    const message = event.data;
    const payload = message.payload;
    switch (message.command) {
        case WebviewMessages.UPDATE_FIELD: {
            updateField(payload.field, payload.value);
            break;
        }
        case WebviewMessages.UPDATE_OPTIONS: {
            updateOptions(payload.field, payload.value);
            break;
        }
        case WebviewMessages.UPDATE_PATTERN: {
            updatePettern(payload.field, payload.value);
            break;
        }
        case WebviewMessages.UPDATE_REQUIRED: {
            updateRequired(payload.field, payload.value);
            break;
        }
        case WebviewMessages.UPDATE_DISABLE: {
            updateDisable(payload.field, payload.value);
            break;
        }
        case WebviewMessages.UPDATE_INVALID: {
            updateInvalid(payload.field, payload.value);
            break;
        }
        case WebviewMessages.UPDATE_ICON: {
            updateIcon(payload.field, payload.value);
            break;
        }
        case WebviewMessages.UPDATE_SPIN: {
            updateSpin(payload.field, payload.value);
            break;
        }
    }
});

const updateField = (fieldName, value) => {
    const { type, field } = fieldMapper.get(fieldName);
    fieldUpdateMapper.get(type)(field, value, fieldName);
};

const updatePettern = (fieldName, value) => {
    const { field } = fieldMapper.get(fieldName);
    if (!field) {
        return;
    }
    if (value) {
        field?.setAttribute('pattern', value);
        field?.setAttribute('placeholder', value);
    } else {
        field?.removeAttribute('pattern');
        field?.removeAttribute('placeholder');
    }
};

const updateOptions = (fieldName, options) => {
    const { field } = fieldMapper.get(fieldName);
    if (!field) {
        return;
    }
    // @ts-ignore
    field.innerHTML = null;
    options?.forEach((option) => {
        var optionElement = document.createElement('vscode-option');
        optionElement.value = option.name;
        optionElement.innerHTML = option.name;
        if (option.disabled) {
            optionElement.setAttribute(DISABLED_ATTRIBUTE, '');
        }
        field.appendChild(optionElement);
    });
};

const getOptions = (fieldName) => {
    const { field } = fieldMapper.get(fieldName);
    if (!field) {
        return;
    }
    return field.options;
};

const sendFieldValue = (fieldName, field) => {
    if (!fieldName) {
        return;
    }
    const value = field?.value?.trim() ?? "";
    vscode.postMessage({
        command: WebviewMessages.UPDATE_FIELD,
        payload: {
            field: fieldName,
            value
        }
    });
};

const deleteFieldValue = (fieldName, value) => {
    if (!fieldName || !value) {
        return;
    }
    vscode.postMessage({
        command: WebviewMessages.DELETE,
        payload: {
            field: fieldName,
            value
        }
    });
};

const getInput = (field) => {
    if (!field) {
        return;
    }
    const shadowRoot = field.shadowRoot;
    if (!shadowRoot) {
        return;
    }
    return shadowRoot.querySelector('input');
};

const updateRequired = (fieldName, value) => {
    const { field } = fieldMapper.get(fieldName);
    if (!field) {
        return;
    }
    if (value === 'true') {
        field.setAttribute('required', '');

        if (field.type === 'select-one') {
            recreateSelect(fieldName, field);
        }
    } else {
        field.removeAttribute('required');
    }
};

const recreateSelect = (fieldName, field) => {
    const clone = field.cloneNode(true);
    const parent = field.parentElement;
    field.remove();
    parent.appendChild(clone);
    clone.open = false;
    fieldMapper.set(fieldName, { type: FieldTypes.SINGLE_SELECT, field: clone });
    fieldListenersMapper.get(FieldTypes.SINGLE_SELECT)(fieldName, clone);
};

const updateDisable = (fieldName, disabled) => {
    const { field } = fieldMapper.get(fieldName);
    if (!field) {
        return;
    }
    if (disabled === 'true') {
        field.setAttribute(DISABLED_ATTRIBUTE, '');
    } else {
        field.removeAttribute(DISABLED_ATTRIBUTE);
    }
};

const updateInvalid = (fieldName, disabled) => {
    const { field } = fieldMapper.get(fieldName);
    if (!field) {
        return;
    }
    if (disabled === 'true') {
        field.setAttribute('invalid', '');
    } else {
        field.removeAttribute('invalid');
    }
};

const updateSpin = (fieldName, value) => {
    const { field } = fieldMapper.get(fieldName);
    if (!field) {
        return;
    }
    if (value === 'true') {
        field.setAttribute('spin', '');
    } else {
        field.removeAttribute('spin');
    }
};

const updateIcon = (fieldName, value) => {
    const { field } = fieldMapper.get(fieldName);
    if (!field) {
        return;
    }
    const clazz = fieldIconMapper.get(fieldName);
    if (clazz) {
        field.classList.remove(clazz);
    }
    field.setAttribute('name', value);
    if (value) {
        field.classList.add(value);
        fieldIconMapper.set(fieldName, value);
    }
};

const requestField = (fieldName) => {
    vscode.postMessage({
        command: WebviewMessages.REQUEST_FIELD,
        payload: {
            field: fieldName
        }
    });
};

const requestSingleSelectOptions = (fieldName, field) => {
    updateOptions(fieldName, [{ name: 'Loading...', disabled: true }]);
    vscode.postMessage({
        command: WebviewMessages.REQUEST_OPTIONS,
        payload: {
            field: fieldName
        }
    });
};
