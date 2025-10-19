// Backward Compatibility Check specific logic

const BackwardCompatibilityFields = {
    RUN_CHECK: 'runCheck',
    BASELINE_REFERENCE: 'baselineReference',
    EXCLUDE_COMPONENTS_SCOPE: 'excludeComponentsScope'
};

// Register field types
typeFieldMapper.set(BackwardCompatibilityFields.RUN_CHECK, FieldTypes.CHECKBOX);
typeFieldMapper.set(BackwardCompatibilityFields.BASELINE_REFERENCE, FieldTypes.INPUT);
typeFieldMapper.set(BackwardCompatibilityFields.EXCLUDE_COMPONENTS_SCOPE, FieldTypes.CHECKBOX);

// Add listener for checkbox
const runCheckField = getField(BackwardCompatibilityFields.RUN_CHECK);
if (runCheckField) {
    runCheckField.addEventListener('change', () => {
        const checked = runCheckField.checked;

        // Send the checked state as string
        vscode.postMessage({
            command: WebviewMessages.UPDATE_FIELD,
            payload: {
                field: BackwardCompatibilityFields.RUN_CHECK,
                value: checked.toString()
            }
        });

        // Enable/disable baseline reference input based on checkbox
        const baselineField = getField(BackwardCompatibilityFields.BASELINE_REFERENCE);
        if (baselineField) {
            if (checked) {
                baselineField.removeAttribute(DISABLED_ATTRIBUTE);
            } else {
                baselineField.setAttribute(DISABLED_ATTRIBUTE, '');
            }
        }
    });
}

// Add listener for baseline reference input
const baselineField = getField(BackwardCompatibilityFields.BASELINE_REFERENCE);
if (baselineField) {
    baselineField.addEventListener('input', () => {
        sendFieldValue(BackwardCompatibilityFields.BASELINE_REFERENCE);
    });
}

// Add listener for exclude components scope checkbox
const excludeComponentsScopeField = getField(BackwardCompatibilityFields.EXCLUDE_COMPONENTS_SCOPE);
if (excludeComponentsScopeField) {
    excludeComponentsScopeField.addEventListener('change', () => {
        const checked = excludeComponentsScopeField.checked;

        // Send the checked state as string
        vscode.postMessage({
            command: WebviewMessages.UPDATE_FIELD,
            payload: {
                field: BackwardCompatibilityFields.EXCLUDE_COMPONENTS_SCOPE,
                value: checked.toString()
            }
        });
    });
}

// Request initial field values on load
requestField(BackwardCompatibilityFields.RUN_CHECK);
requestField(BackwardCompatibilityFields.BASELINE_REFERENCE);
requestField(BackwardCompatibilityFields.EXCLUDE_COMPONENTS_SCOPE);

// Listen for spinner control messages
window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.command === 'showSpinner') {
        const spinner = document.getElementById('bwc-spinner');
        if (spinner) {
            if (message.payload.show) {
                spinner.classList.add('show');
            } else {
                spinner.classList.remove('show');
            }
        }
    }
});

