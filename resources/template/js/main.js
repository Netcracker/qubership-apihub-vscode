// @ts-check
const vscode = acquireVsCodeApi();

const PublishWebviewMessages = {
    UPDATE_OPTIONS: 'updateOptions',
    UPDATE_FIELD: 'updateField',
    UPDATE_PATTERN: 'updatePattern',
    UPDATE_DISABLE: 'updateDisable',
    UPDATE_REQUIRED: 'updateRequired',
    REQUEST_FIELD: 'requestField',
    REQUEST_OPTIONS: 'requestOptions',
    UPDATE_INVALID: 'updateInvalid',
    UPDATE_ICON: 'updateIcon',
    UPDATE_SPIN: 'updateSpin'
};
const DISABLED_ATTRIBUTE = 'disabled';

const fieldMapper = new Map();
const fieldUpdateMapper = new Map();
const fieldIconMapper = new Map();

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
        case PublishWebviewMessages.UPDATE_REQUIRED: {
            updateRequired(payload.field, payload.value);
            break;
        }
        case PublishWebviewMessages.UPDATE_DISABLE: {
            updateDisable(payload.field, payload.value);
            break;
        }
        case PublishWebviewMessages.UPDATE_INVALID: {
            updateInvalid(payload.field, payload.value);
            break;
        }
        case PublishWebviewMessages.UPDATE_ICON: {
            updateIcon(payload.field, payload.value);
            break;
        }
        case PublishWebviewMessages.UPDATE_SPIN: {
            updateSpin(payload.field, payload.value);
            break;
        }
    }
});

const updateField = (fieldName, value) => fieldUpdateMapper.get(fieldName)(value);

const updatePettern = (fieldName, value) => {
    const field = fieldMapper.get(fieldName);
    if (!field) {
        return;
    }
    field?.setAttribute('pattern', value);
    field?.setAttribute('placeholder', value);
};

const updateOptions = (fieldName, options) => {
    const field = fieldMapper.get(fieldName);
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

const sendFieldValue = (fieldName, field) => {
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
};

const deleteFieldValue = (fieldName, value) => {
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
    const field = fieldMapper.get(fieldName);
    if (!field) {
        return;
    }
    if (value === 'true') {
        field.setAttribute('required', '');
    } else {
        field.removeAttribute('required');
    }
};

const updateDisable = (fieldName, disabled) => {
    const field = fieldMapper.get(fieldName);
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
    const field = fieldMapper.get(fieldName);
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
    const field = fieldMapper.get(fieldName);
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
    const field = fieldMapper.get(fieldName);
    if (!field) {
        return;
    }
    const clazz = fieldIconMapper.get(fieldName);
    if (clazz) {
        field.classList.remove(clazz);
    }
    field.setAttribute('name', value);
    if(value){
        field.classList.add(value);
        fieldIconMapper.set(fieldName, value);
    }
};

const requestField = (fieldName) => {
    vscode.postMessage({
        command: PublishWebviewMessages.REQUEST_FIELD,
        payload: {
            field: fieldName
        }
    });
};
