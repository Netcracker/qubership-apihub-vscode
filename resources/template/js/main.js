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
    SINGLE_SELECT_COMBOBOX: 'single-select-combobox',
    BUTTON: 'button',
    LABELS: 'labels'
};

const DISABLED_ATTRIBUTE = 'disabled';

const typeFieldMapper = new Map();
const iconFieldMapper = new Map();
const updateFieldMapper = new Map();
const defaultListenersMapper = new Map();

const LABELS_ID = 'labelForLabels';
const LABELS_PLACEHOLDER = 'publish-labels-placeholder';

updateFieldMapper.set(FieldTypes.INPUT, (fieldName, value) => {
    getInput(fieldName).value = value;
});

updateFieldMapper.set(FieldTypes.SINGLE_SELECT, (fieldName, value) => {
    getField(fieldName).selectedIndex = field.options.findIndex((option) => option.value === value);
});

updateFieldMapper.set(FieldTypes.SINGLE_SELECT_COMBOBOX, (fieldName, value) => {
    getField(fieldName).selectedIndex = field.options.findIndex((option) => option.value === value);
});

updateFieldMapper.set(FieldTypes.BUTTON, (fieldName, value) => {
    getField(fieldName).disabled = value === 'true';
});

updateFieldMapper.set(FieldTypes.LABELS, (fieldName, value) => {
    const oldLabelPlaceholder = document.querySelector(`#${LABELS_PLACEHOLDER}`);
    if (oldLabelPlaceholder) {
        oldLabelPlaceholder.remove();
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

defaultListenersMapper.set(FieldTypes.INPUT, (fieldName) => {
    const field = getField(fieldName);
    field.addEventListener('input', () => sendFieldValue(fieldName, field));
});

defaultListenersMapper.set(FieldTypes.SINGLE_SELECT, (fieldName) => {
    const field = getField(fieldName);
    field.addEventListener('change', () => sendFieldValue(fieldName));
});

defaultListenersMapper.set(FieldTypes.SINGLE_SELECT_COMBOBOX, (fieldName) => {
    const field = getField(fieldName);
    field.addEventListener('change', () => sendFieldValue(fieldName));
    field.addEventListener('focusout', () => {
        // WA. Bug: https://github.com/vscode-elements/elements/issues/368
        const value = getInput(fieldName).value;
        if (!value?.length) {
            // @ts-ignore
            field.selectedIndex = -1;
            sendFieldValue(fieldName, '');
            updateRequired(fieldName, 'true');
            return;
        }
        const index = field.selectedIndex;
        const option = getOptions(fieldName)?.[index];
        if (index === -1 || !option || option.value !== value) {
            sendFieldValue(fieldName, '');
            updateRequired(fieldName, 'true');
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
            updatePattern(payload.field, payload.value);
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
    try{
    const type = typeFieldMapper.get(fieldName);
    updateFieldMapper.get(type)(fieldName, value);
    }catch (e){
        console.log();
    }
};

const getField = (FieldName) => {
    return document.querySelector(`#${FieldName}`);
};

const updatePattern = (fieldName, value) => {
    const field = getField(fieldName);
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
    const field = getField(fieldName);
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
    const field = getField(fieldName);
    if (!field) {
        return;
    }
    return field.options;
};

const sendFieldValue = (fieldName) => {
    if (!fieldName) {
        return;
    }
    const field = getField(fieldName);
    const value = field?.value?.trim() ?? '';
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

const getInput = (fieldName) => {
    if (!fieldName) {
        return;
    }
    const field = getField(fieldName);
    const shadowRoot = field.shadowRoot;
    if (!shadowRoot) {
        return;
    }
    return shadowRoot.querySelector('input');
};

const updateRequired = (fieldName, value) => {
    const field = getField(fieldName);
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

// WA. Bug: https://github.com/vscode-elements/elements/issues/369
const recreateSelect = (fieldName, field) => {
    const clone = field.cloneNode(true);
    const parent = field.parentElement;
    field.remove();
    parent.appendChild(clone);
    clone.open = false;
    defaultListenersMapper.get(FieldTypes.SINGLE_SELECT_COMBOBOX)(fieldName, clone);
};

const updateDisable = (fieldName, disabled) => {
    const field = getField(fieldName);
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
    const field = getField(fieldName);
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
    const field = getField(fieldName);
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
    const field = getField(fieldName);
    if (!field) {
        return;
    }
    const clazz = iconFieldMapper.get(fieldName);
    if (clazz) {
        field.classList.remove(clazz);
    }
    field.setAttribute('name', value);
    if (value) {
        field.classList.add(value);
        iconFieldMapper.set(fieldName, value);
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

const requestSingleSelectOptions = (fieldName) => {
    updateOptions(fieldName, [{ name: 'Loading...', disabled: true }]);
    vscode.postMessage({
        command: WebviewMessages.REQUEST_OPTIONS,
        payload: {
            field: fieldName
        }
    });
};
