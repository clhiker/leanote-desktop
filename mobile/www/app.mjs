import {
    normalizeServerUrl,
    loadServers,
    getLastServer,
    saveServer,
    clearServers,
} from './server-url.mjs';

const cfg = window.LEANOTE_MOBILE_CONFIG || {};
const allowHttp = cfg.allowHttp !== false;
const form = document.getElementById('server-form');
const input = document.getElementById('server');
const errorEl = document.getElementById('error');
const recentEl = document.getElementById('recent');
const recentList = document.getElementById('recent-list');
const forgetBtn = document.getElementById('forget');

input.value = cfg.defaultServer || getLastServer() || '';
renderRecent();

form.addEventListener('submit', event => {
    event.preventDefault();
    openServer(input.value);
});

forgetBtn.addEventListener('click', () => {
    clearServers();
    input.value = cfg.defaultServer || '';
    hideError();
    renderRecent();
    input.focus();
});

function openServer(raw) {
    const result = normalizeServerUrl(raw, { allowHttp });
    if (!result.ok) {
        showError(result.error);
        input.focus();
        return;
    }
    hideError();
    saveServer(result.url);
    window.location.assign(result.url);
}

function renderRecent() {
    const servers = loadServers();
    recentList.replaceChildren();
    recentEl.hidden = servers.length === 0;
    forgetBtn.hidden = servers.length === 0;
    for (const url of servers) {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = url;
        button.title = url;
        button.addEventListener('click', () => {
            input.value = url;
            openServer(url);
        });
        li.appendChild(button);
        recentList.appendChild(li);
    }
}

function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
}

function hideError() {
    errorEl.textContent = '';
    errorEl.hidden = true;
}
