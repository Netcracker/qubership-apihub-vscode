// @ts-check

(function () {
    const PASSWORD_TYPE = 'password';
    const TEXT_TYPE = 'text';
    const CLOSED_EYE_ICON = 'eye-closed';
    const EYE_ICON = 'eye';
    const ACTIVE_CLASS = 'active';

    const EnvironmentWebviewFields = {
        URL: 'url',
        TOKEN: 'token',
        TEST_CONNECTION_BUTTON: 'testConnectionButton',
        TEST_CONNECTION_ICON: 'testConnectionIcon'
    };

    const inputUrl = document.querySelector('#url');
    const inputToken = document.querySelector('#token');
    const togglePasswordButton = document.querySelector('#eye-icon');
    const testConnectionButton = document.querySelector('#testConnectionButton');
    const testConnectionIcon = document.querySelector('#testConnectionIcon');

    fieldMapper.set(EnvironmentWebviewFields.URL, {type: FieldTypes.INPUT, field: inputUrl});
    fieldMapper.set(EnvironmentWebviewFields.TOKEN, {type: FieldTypes.INPUT, field: inputToken});
    fieldMapper.set(EnvironmentWebviewFields.TEST_CONNECTION_BUTTON, {type: FieldTypes.BUTTON, field: testConnectionButton});
    fieldMapper.set(EnvironmentWebviewFields.TEST_CONNECTION_ICON, {type: FieldTypes.BUTTON, field: testConnectionIcon});

    if (inputUrl) {
        fieldListenersMapper.get(FieldTypes.INPUT)(EnvironmentWebviewFields.URL, inputUrl);
    }
    if (inputToken) {
        fieldListenersMapper.get(FieldTypes.INPUT)(EnvironmentWebviewFields.TOKEN, inputToken);
    }
    if (togglePasswordButton) {
        togglePasswordButton.addEventListener('click', updateTogglePasswordButton);
    }    
    if (testConnectionButton) {
        testConnectionButton.addEventListener('click', testConnection);
    }

    function updateTogglePasswordButton() {
        if (!inputToken || !togglePasswordButton) {
            return;
        }
        // @ts-ignore
        if (inputToken.type === PASSWORD_TYPE) {
            // @ts-ignore
            inputToken.type = TEXT_TYPE;
            // @ts-ignore
            togglePasswordButton.name = CLOSED_EYE_ICON;
            togglePasswordButton.classList.add(ACTIVE_CLASS);
        } else {
            // @ts-ignore
            inputToken.type = PASSWORD_TYPE;
            // @ts-ignore
            togglePasswordButton.name = EYE_ICON;
            togglePasswordButton.classList.remove(ACTIVE_CLASS);
        }
    }

    function requestDefaultValues() {
        requestField(EnvironmentWebviewFields.URL);
        requestField(EnvironmentWebviewFields.TOKEN);
    }

    function testConnection(){
        vscode.postMessage({
            command: 'testConnection',
            payload: {
                token: getInput(inputToken).value,
                host: getInput(inputUrl).value,
            }
        });
    }
    requestDefaultValues();
})();
