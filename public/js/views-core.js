// Telas principais: login e dashboard.
const Views = {};

Views.login = (container) => {
  container.innerHTML = '';
  const box = el(`<div class="login-wrap">
    <div class="login-card">
      <img src="/icons/icon-192.png" alt="" class="login-logo">
      <h1>Fatura Expert</h1>
      <p class="muted">CRM da Fatura Expert</p>
      <form>
        <div class="field"><label>E-mail</label><input type="email" name="email" required autocomplete="username"></div>
        <div class="field"><label>Senha</label><input type="password" name="password" required autocomplete="current-password"></div>
        <button class="btn btn-primary btn-block">Entrar</button>
        <p class="login-err"></p>
      </form>
    </div></div>`);
  box.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const err = box.querySelector('.login-err');
    err.textContent = '';
    try {
      const { token, user } = await API.post('/auth/login', {
        email: box.querySelector('[name=email]').value,
        password: box.querySelector('[name=password]').value,
      });
      API.setToken(token);
      App.boot(user);
    } catch (ex) { err.textContent = ex.message; }
  };
  container.appendChild(box);
};

Views.dashboard = async (container) => {
  container.innerHTML = '<div class="loading">Carregando painel…</div>';
  let d;
  try { d = await API.get('/dashboard'); } catch (err) {
    container.innerHTML = `<p class="muted">${esc(err.message)}</p>`; return;
  }
  const i = d.indicators;
  const card = (title, value, sub, route, accent) => `
    <a class="stat-card" href="#/${route || 'dashboard'}" style="--accent:${accent || '#2a78d6'}">
      <span class="stat-title">${title}</span>
      <span class="stat-value">${value}</span>
      ${sub ? `<span class="stat-sub muted">${sub}</span>` : ''}
    </a>`;

  container.innerHTML = `
    <div class="page-head"><h2>Dashboard</h2><span class="muted">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
    <div class="stats-grid">
      ${card('Clientes ativos', i.activeClients, '', 'companies', '#2a78d6')}
      ${card('Novos leads (mês)', i.newLeads, '', 'leads', '#2a78d6')}
      ${card('Propostas em aberto', i.proposals.count, fmtMoney(i.proposals.value), 'leads', '#eda100')}
      ${card('Fechados no mês', i.closedMonth.count, fmtMoney(i.closedMonth.value), 'leads', '#008300')}
      ${card('Contestações em andamento', i.disputesOpen.count, fmtMoney(i.disputesOpen.value) + ' contestados', 'disputes', '#eb6834')}
      ${card('Contestações finalizadas', i.disputesDone.count, fmtMoney(i.disputesDone.value) + ' recuperados', 'disputes', '#008300')}
      ${card('Economia gerada', fmtMoney(i.savingsTotal), 'contestações + análises + readequações', 'reports', '#008300')}
      ${card('Receita no mês', fmtMoney(i.revenueMonth), '', 'finance', '#2a78d6')}
      ${card('Receita prevista', fmtMoney(i.revenueForecast), 'pendentes + atrasadas', 'finance', '#eda100')}
      ${card('Tarefas pendentes', i.tasksPending, '', 'tasks', i.tasksPending ? '#eda100' : '#008300')}
      ${card('Follow-ups atrasados', i.followupsLate, '', 'agenda', i.followupsLate ? '#e34948' : '#008300')}
      ${card('Agenda de hoje', d.agendaToday.length, 'compromissos', 'agenda', '#4a3aa7')}
    </div>
    <div class="charts-grid">
      <div class="card"><h3>Vendas por mês</h3><div id="ch-sales"></div></div>
      <div class="card"><h3>Economia gerada por mês</h3><div id="ch-savings"></div></div>
      <div class="card"><h3>Conversão do funil</h3><div id="ch-funnel"></div></div>
      <div class="card"><h3>Performance por consultor</h3><div id="ch-consultants"></div></div>
    </div>
    <div class="card agenda-today">
      <h3>Agenda do dia</h3>
      ${d.agendaToday.length ? d.agendaToday.map((e) => `
        <div class="agenda-item">
          <span class="agenda-time">${new Date(e.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          ${badge(label(e.type), '#4a3aa7')}
          <span>${esc(e.title)}</span>
          <span class="muted">${esc(e.user_name || '')}${e.location ? ' • ' + esc(e.location) : ''}</span>
        </div>`).join('') : '<p class="muted">Nenhum compromisso para hoje.</p>'}
    </div>`;

  const short = (v, axis) => axis
    ? (v >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : Math.round(v))
    : fmtMoney(v);
  Charts.bar(container.querySelector('#ch-sales'),
    d.charts.salesByMonth.map((r) => ({ label: Charts.monthLabel(r.month), value: Number(r.value), extra: `${r.n} negócio(s)` })),
    { color: '#2a78d6', fmt: short });
  Charts.bar(container.querySelector('#ch-savings'),
    d.charts.savingsByMonth.map((r) => ({ label: Charts.monthLabel(r.month), value: Number(r.value) })),
    { color: '#008300', fmt: short });
  Charts.funnel(container.querySelector('#ch-funnel'), d.charts.funnel, { fmt: fmtMoney });
  Charts.hbar(container.querySelector('#ch-consultants'),
    d.charts.consultants.map((c) => ({
      name: c.name, value: Number(c.value),
      tip: `${c.won} de ${c.total} leads fechados<br>${fmtMoney(Number(c.value))}`,
    })),
    { color: '#4a3aa7', fmt: fmtMoney });
};
