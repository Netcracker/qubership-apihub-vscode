// @ts-check

(function () {
    const PASSWORD_TYPE = 'password';
    const TEXT_TYPE = 'text';
    const CLOSED_EYE_ICON = 'eye-closed';
    const EYE_ICON = 'eye';
    const ACTIVE_CLASS = 'active';

    const EnvironmentWebviewFields = {
        URL: 'url',
        TOKEN: 'token'
    };

    const inputUrl = document.querySelector('#url');
    const inputToken = document.querySelector('#token');
    const togglePasswordButton = document.querySelector('#eye-icon');

    fieldMapper.set(EnvironmentWebviewFields.URL, inputUrl);
    fieldMapper.set(EnvironmentWebviewFields.TOKEN, inputToken);

    if (inputUrl) {
        inputUrl.addEventListener('input', () => sendFieldValue(EnvironmentWebviewFields.URL, inputUrl));
    }
    if (inputToken) {
        inputToken.addEventListener('input', () => sendFieldValue(EnvironmentWebviewFields.TOKEN, inputToken));
    }
    if (togglePasswordButton) {
        togglePasswordButton.addEventListener('click', updateTogglePasswordButton);
    }

    fieldUpdateMapper.set(EnvironmentWebviewFields.URL, (value) => {
        getInput(inputUrl).value = value;
    });    
    fieldUpdateMapper.set(EnvironmentWebviewFields.TOKEN, (value) => {
        getInput(inputToken).value = value;
    });

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
    requestDefaultValues();
})();
