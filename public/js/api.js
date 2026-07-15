// Cliente da API REST com JWT.
const API = {
  token: localStorage.getItem('fablecrm_token') || null,

  setToken(t) {
    this.token = t;
    if (t) localStorage.setItem('fablecrm_token', t);
    else localStorage.removeItem('fablecrm_token');
  },

  async request(path, opts = {}) {
    const headers = opts.headers || {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (opts.body && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    let res;
    try {
      res = await fetch(`/api${path}`, { ...opts, headers });
    } catch {
      throw new Error('Sem conexão com o servidor');
    }
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      API.setToken(null);
      location.hash = '#/login';
      location.reload();
      throw new Error('Sessão expirada');
    }
    if (!res.ok) {
      let msg = `Erro ${res.status}`;
      try { msg = (await res.json()).error || msg; } catch { /* sem corpo */ }
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  },

  get: (p) => API.request(p),
  post: (p, body) => API.request(p, { method: 'POST', body }),
  put: (p, body) => API.request(p, { method: 'PUT', body }),
  patch: (p, body) => API.request(p, { method: 'PATCH', body }),
  del: (p) => API.request(p, { method: 'DELETE' }),

  // Baixa um arquivo autenticado (relatórios, documentos, .ics).
  async download(path, filename) {
    const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${this.token}` } });
    if (!res.ok) {
      let msg = `Erro ${res.status}`;
      try { msg = (await res.json()).error || msg; } catch { /* sem corpo */ }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || (res.headers.get('Content-Disposition') || '').split('filename=')[1]?.replace(/"/g, '') || 'arquivo';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  async upload(path, file, extra = {}) {
    const fd = new FormData();
    fd.append('file', file);
    for (const [k, v] of Object.entries(extra)) if (v != null && v !== '') fd.append(k, v);
    return API.request(path, { method: 'POST', body: fd });
  },
};
