// @ts-check

(function () {
    const PASSWORD_TYPE = 'password';
    const TEXT_TYPE = 'text';
    const CLOSED_EYE_ICON = 'eye-closed';
    const EYE_ICON = 'eye';
    const ACTIVE_CLASS = 'active';

    const UPDATE_URL_ACTION = 'updateUrl';
    const UPDATE_TOKEN_ACTION = 'updateToken';

    const REQUEST_TOKEN_ACTION = 'requestToken';
    const REQUEST_URL_ACTION = 'requestUrl';

    // @ts-ignore
    const vscode = acquireVsCodeApi();
    const inputUrl = document.querySelector('#url');
    const inputToken = document.querySelector('#token');
    const togglePasswordButton = document.querySelector('#eye-icon');

    if (inputUrl) {
        inputUrl.addEventListener('input', updateUrlValue);
    }
    if (inputToken) {
        inputToken.addEventListener('input', updateTokenValue);
    }
    if (togglePasswordButton) {
        togglePasswordButton.addEventListener('click', updateTogglePasswordButton);
    }

    function updateUrlValue() {
        if (!inputUrl) {
            return;
        }
        vscode.postMessage({
            command: UPDATE_URL_ACTION,
            // @ts-ignore
            payload: inputUrl.value
        });
    }

    function updateTokenValue() {
        if (!inputToken) {
            return;
        }
        vscode.postMessage({
            command: UPDATE_TOKEN_ACTION,
            // @ts-ignore
            payload: inputToken.value
        });
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

    window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.command === UPDATE_URL_ACTION) {
            if (!inputUrl) {
                return;
            }
            // @ts-ignore
            inputUrl.value = message.payload;
        }
        if (message.command === UPDATE_TOKEN_ACTION) {
            if (!inputToken) {
                return;
            }
            // @ts-ignore
            inputToken.value = message.payload;
        }
    });

    function requestDefaultValues() {
        vscode.postMessage({
            command: REQUEST_TOKEN_ACTION,
            payload: {}
        });

        vscode.postMessage({
            command: REQUEST_URL_ACTION,
            payload: {}
        });
    }
    requestDefaultValues();
})();
