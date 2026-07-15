// Gráficos SVG sem dependências. Cores da paleta validada (CVD-safe):
// azul #2a78d6 (vendas), verde #008300 (economia), violeta #4a3aa7 (consultores).
const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  let tip;
  function tooltip() {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tip';
      document.body.appendChild(tip);
    }
    return tip;
  }
  function showTip(evt, html) {
    const t = tooltip();
    t.innerHTML = html;
    t.style.display = 'block';
    const pad = 12;
    let x = evt.clientX + pad, y = evt.clientY + pad;
    const r = t.getBoundingClientRect();
    if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - pad;
    if (y + r.height > innerHeight - 8) y = evt.clientY - r.height - pad;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }

  const svgEl = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const niceMax = (v) => {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
    return 10 * p;
  };
  const monthLabel = (m) => {
    const [y, mm] = m.split('-');
    return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+mm - 1] + '/' + y.slice(2);
  };

  // Barras verticais (série única) com grade recessiva e tooltip.
  function bar(container, data, { color = '#2a78d6', fmt = (v) => v, height = 220 } = {}) {
    container.innerHTML = '';
    if (!data.length) { container.innerHTML = '<p class="muted empty-chart">Sem dados no período.</p>'; return; }
    const W = 600, H = height, padL = 46, padB = 26, padT = 10;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
    const max = niceMax(Math.max(...data.map((d) => d.value)));
    const plotW = W - padL - 8, plotH = H - padT - padB;
    for (let i = 0; i <= 4; i++) {
      const y = padT + plotH - (i / 4) * plotH;
      svg.appendChild(svgEl('line', { x1: padL, x2: W - 8, y1: y, y2: y, class: 'grid' }));
      const lbl = svgEl('text', { x: padL - 6, y: y + 3, class: 'tick', 'text-anchor': 'end' });
      lbl.textContent = fmt(max * i / 4, true);
      svg.appendChild(lbl);
    }
    const bw = Math.min(40, plotW / data.length * 0.6);
    const maxIdx = data.reduce((mi, d, i) => d.value > data[mi].value ? i : mi, 0);
    data.forEach((d, i) => {
      const x = padL + (i + 0.5) * (plotW / data.length) - bw / 2;
      const h = max ? (d.value / max) * plotH : 0;
      const y = padT + plotH - h;
      const rect = svgEl('path', {
        d: `M${x},${padT + plotH} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + bw - 4} Q${x + bw},${y} ${x + bw},${y + 4} V${padT + plotH} Z`,
        fill: color,
      });
      rect.addEventListener('mousemove', (e) => showTip(e, `<b>${d.label}</b><br>${fmt(d.value)}${d.extra ? `<br>${d.extra}` : ''}`));
      rect.addEventListener('mouseleave', hideTip);
      svg.appendChild(rect);
      // alvo de hover maior que a marca
      const hit = svgEl('rect', { x: x - 4, y: padT, width: bw + 8, height: plotH, fill: 'transparent' });
      hit.addEventListener('mousemove', (e) => showTip(e, `<b>${d.label}</b><br>${fmt(d.value)}${d.extra ? `<br>${d.extra}` : ''}`));
      hit.addEventListener('mouseleave', hideTip);
      svg.appendChild(hit);
      if (i === maxIdx && d.value > 0) { // rótulo direto apenas no maior valor
        const t = svgEl('text', { x: x + bw / 2, y: y - 5, class: 'dlabel', 'text-anchor': 'middle' });
        t.textContent = fmt(d.value, true);
        svg.appendChild(t);
      }
      const xl = svgEl('text', { x: x + bw / 2, y: H - 8, class: 'tick', 'text-anchor': 'middle' });
      xl.textContent = d.label.length > 8 ? d.label.slice(0, 8) : d.label;
      svg.appendChild(xl);
    });
    container.appendChild(svg);
  }

  // Barras horizontais com rótulo e valor direto por linha.
  function hbar(container, data, { color = '#4a3aa7', fmt = (v) => v, valueKey = 'value' } = {}) {
    container.innerHTML = '';
    if (!data.length) { container.innerHTML = '<p class="muted empty-chart">Sem dados no período.</p>'; return; }
    const max = Math.max(...data.map((d) => Number(d[valueKey])), 1);
    const wrap = document.createElement('div');
    wrap.className = 'hbar';
    for (const d of data) {
      const pct = Math.max(2, (Number(d[valueKey]) / max) * 100);
      const row = document.createElement('div');
      row.className = 'hbar-row';
      row.innerHTML = `<span class="hbar-label" title="${d.name}">${d.name}</span>
        <span class="hbar-track"><span class="hbar-fill" style="width:${pct}%;background:${d.color || color}"></span></span>
        <span class="hbar-value">${fmt(Number(d[valueKey]))}</span>`;
      row.addEventListener('mousemove', (e) => showTip(e, `<b>${d.name}</b><br>${d.tip || fmt(Number(d[valueKey]))}`));
      row.addEventListener('mouseleave', hideTip);
      wrap.appendChild(row);
    }
    container.appendChild(wrap);
  }

  // Funil do pipeline: cada etapa rotulada com nome + contagem + valor
  // (a cor do status nunca é a única codificação).
  function funnel(container, stages, { fmt = (v) => v } = {}) {
    container.innerHTML = '';
    const max = Math.max(...stages.map((s) => s.n), 1);
    const wrap = document.createElement('div');
    wrap.className = 'funnel';
    for (const s of stages) {
      const pct = Math.max(4, (s.n / max) * 100);
      const row = document.createElement('div');
      row.className = 'funnel-row';
      row.innerHTML = `<span class="funnel-label">${s.name}</span>
        <span class="funnel-track"><span class="funnel-fill" style="width:${pct}%;background:${s.color}"></span></span>
        <span class="funnel-value">${s.n} lead${s.n === 1 ? '' : 's'} · ${fmt(Number(s.value))}</span>`;
      row.addEventListener('mousemove', (e) =>
        showTip(e, `<b>${s.name}</b><br>${s.n} lead(s)<br>${fmt(Number(s.value))} em valor estimado`));
      row.addEventListener('mouseleave', hideTip);
      wrap.appendChild(row);
    }
    container.appendChild(wrap);
  }

  return { bar, hbar, funnel, monthLabel };
})();
