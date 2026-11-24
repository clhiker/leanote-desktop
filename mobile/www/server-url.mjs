export const SERVERS_KEY = 'leanote.mobile.servers';
export const LAST_KEY = 'leanote.mobile.lastServer';
export const MAX_SERVERS = 5;

export function normalizeServerUrl(raw, { allowHttp = true } = {}) {
    let value = String(raw == null ? '' : raw).trim();
    if (!value) return { ok: false, error: '请输入服务器地址' };

    const warnings = [];
    if (!/^https?:\/\//i.test(value)) {
        const hostPort = /^[^/]+:\d+(\/|$)/.test(value);
        if (!hostPort && /^[a-z][a-z0-9+.-]*:/i.test(value)) {
            return { ok: false, error: '只支持 http:// 或 https:// 地址' };
        }
        value = 'https://' + value;
        warnings.push('已自动补全 https://');
    }

    let url;
    try {
        url = new URL(value);
    } catch {
        return { ok: false, error: '服务器地址格式不正确' };
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { ok: false, error: '只支持 http:// 或 https:// 地址' };
    }
    if (!url.hostname) return { ok: false, error: '服务器地址缺少主机名' };
    if (url.username || url.password) {
        return { ok: false, error: '请不要把用户名或密码写进服务器地址' };
    }
    if (url.protocol === 'http:' && !allowHttp) {
        return { ok: false, error: '当前版本只允许 https:// 服务器' };
    }

    url.hash = '';
    let normalized = url.toString();
    if (!url.search && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }

    if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
        warnings.push('在手机上 localhost 指向手机本身，请填写可访问的服务器地址');
    }
    if (url.protocol === 'http:') {
        warnings.push('使用 HTTP 连接，注意网络安全');
    }

    return { ok: true, url: normalized, warnings };
}

function store(storage) {
    if (storage) return storage;
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        return null;
    }
}

export function loadServers(storage) {
    const s = store(storage);
    if (!s) return [];
    try {
        const list = JSON.parse(s.getItem(SERVERS_KEY) || '[]');
        if (!Array.isArray(list)) return [];
        return [...new Set(list.filter(x => typeof x === 'string' && x))].slice(0, MAX_SERVERS);
    } catch {
        return [];
    }
}

export function getLastServer(storage) {
    const s = store(storage);
    if (!s) return '';
    return s.getItem(LAST_KEY) || '';
}

export function saveServer(url, storage) {
    const s = store(storage);
    const list = [url, ...loadServers(storage).filter(x => x !== url)].slice(0, MAX_SERVERS);
    if (s) {
        try {
            s.setItem(SERVERS_KEY, JSON.stringify(list));
            s.setItem(LAST_KEY, url);
        } catch {
            // private mode / quota: navigation still works
        }
    }
    return list;
}

export function clearServers(storage) {
    const s = store(storage);
    if (!s) return;
    try {
        s.removeItem(SERVERS_KEY);
        s.removeItem(LAST_KEY);
    } catch {
        // ignore
    }
}
