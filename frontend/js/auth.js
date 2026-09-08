const ACCOUNT_KEY = "keruAccounts";
const CURRENT_USER_KEY = "keruCurrentUser";

function readAccounts() {
    try {
        return JSON.parse(localStorage.getItem(ACCOUNT_KEY)) || [];
    } catch (error) {
        return [];
    }
}

function saveAccounts(accounts) {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
}

function showAccountMessage(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle("is-error", isError);
}

const loginForm = document.getElementById("login-form");
if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const email = document.getElementById("login-email").value.trim().toLowerCase();
        const password = document.getElementById("login-password").value;
        const message = document.getElementById("login-message");
        const account = readAccounts().find((item) => item.email === email && item.password === password);

        if (!account) {
            showAccountMessage(message, "We could not match those details. Try again or create an account.", true);
            return;
        }

        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ name: account.name, email: account.email }));
        window.location.href = "blogs.html";
    });
}

const registerForm = document.getElementById("register-form");
if (registerForm) {
    registerForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = document.getElementById("register-name").value.trim();
        const email = document.getElementById("register-email").value.trim().toLowerCase();
        const password = document.getElementById("register-password").value;
        const message = document.getElementById("register-message");
        const accounts = readAccounts();

        if (accounts.some((item) => item.email === email)) {
            showAccountMessage(message, "An account with that email already exists.", true);
            return;
        }

        accounts.push({ name, email, password });
        saveAccounts(accounts);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ name, email }));
        window.location.href = "blogs.html";
    });
}
