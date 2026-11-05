// Gera um gráfico burn-up (realizado + estimativa) em HTML autocontido, com SVG inline.
// Usado por gerar-relatorio.js.

const DIA = 24 * 60 * 60 * 1000;
const fmt = d => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const fmtLongo = d => new Date(d).toLocaleDateString("pt-BR");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const inicioDoDia = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };

/**
 * @param {object} p
 * @param {Date}   p.inicio          data de criação do projeto
 * @param {Date}   p.hoje
 * @param {Date[]} p.datasConclusao  data em que cada card foi concluído
 * @param {number} p.total           total de cards
 * @param {Date}   [p.fim]           término previsto (sem estimativa se ausente)
 * @param {Date}   [p.prazo]         prazo da entrega
 * @param {string} p.titulo
 */
function gerarGrafico({ inicio, hoje, datasConclusao, total, fim, prazo, titulo }) {
  const t0 = inicioDoDia(inicio);
  const tHoje = hoje.getTime();
  const tFim = fim ? fim.getTime() : null;
  const tPrazo = prazo ? prazo.getTime() : null;
  const feitos = datasConclusao.length;

  // Série realizada: degraus acumulados
  const real = [[t0, 0]];
  let acc = 0;
  for (const t of datasConclusao.map(d => d.getTime()).sort((a, b) => a - b)) {
    real.push([t, acc]);
    acc++;
    real.push([t, acc]);
  }
  real.push([tHoje, acc]);

  // Série estimada: reta de hoje até o término previsto
  const estimativa = tFim ? [[tHoje, feitos], [tFim, total]] : null;

  // Escalas
  const W = 760, H = 380, m = { top: 24, right: 120, bottom: 40, left: 44 };
  const pw = W - m.left - m.right, ph = H - m.top - m.bottom;
  const tMax = Math.max(tHoje, tFim || 0, tPrazo || 0) + 3 * DIA;
  const x = t => m.left + ((t - t0) / (tMax - t0)) * pw;
  const passoY = Math.max(1, Math.ceil(total / 5));
  const yMax = Math.ceil(total / passoY) * passoY;
  const y = v => m.top + ph - (v / yMax) * ph;

  // Ticks
  const dias = (tMax - t0) / DIA;
  const passoX = (dias > 70 ? 14 : 7) * DIA;
  const ticksX = [];
  for (let t = t0; t <= tMax; t += passoX) ticksX.push(t);
  const ticksY = [];
  for (let v = 0; v <= yMax; v += passoY) ticksY.push(v);

  const caminho = pts => pts.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const svg = [];
  // grade e eixos
  for (const v of ticksY) {
    svg.push(`<line class="grid" x1="${m.left}" x2="${m.left + pw}" y1="${y(v)}" y2="${y(v)}"/>`);
    svg.push(`<text class="tick" x="${m.left - 8}" y="${y(v)}" text-anchor="end" dominant-baseline="middle">${v}</text>`);
  }
  for (const t of ticksX) {
    svg.push(`<text class="tick" x="${x(t)}" y="${m.top + ph + 20}" text-anchor="middle">${fmt(t)}</text>`);
  }
  svg.push(`<line class="axis" x1="${m.left}" x2="${m.left + pw}" y1="${y(0)}" y2="${y(0)}"/>`);

  // escopo total
  svg.push(`<line class="escopo" x1="${m.left}" x2="${m.left + pw}" y1="${y(total)}" y2="${y(total)}"/>`);
  svg.push(`<text class="lbl-sec" x="${m.left + pw + 8}" y="${y(total)}" dominant-baseline="middle">Total: ${total} cards</text>`);

  // hoje
  svg.push(`<line class="hoje" x1="${x(tHoje)}" x2="${x(tHoje)}" y1="${m.top}" y2="${m.top + ph}"/>`);
  svg.push(`<text class="lbl-mut" x="${x(tHoje)}" y="${m.top - 8}" text-anchor="middle">hoje</text>`);

  // prazo
  if (tPrazo) {
    svg.push(`<line class="prazo" x1="${x(tPrazo)}" x2="${x(tPrazo)}" y1="${m.top}" y2="${m.top + ph}"/>`);
    svg.push(`<text class="lbl-pri" x="${x(tPrazo)}" y="${m.top - 8}" text-anchor="middle">Prazo ${fmt(tPrazo)}</text>`);
  }

  // séries
  if (estimativa) svg.push(`<path class="serie estimada" d="${caminho(estimativa)}"/>`);
  svg.push(`<path class="serie real" d="${caminho(real)}"/>`);
  svg.push(`<circle class="ponto" cx="${x(tHoje)}" cy="${y(feitos)}" r="4.5"/>`);
  if (estimativa) {
    svg.push(`<circle class="ponto vazio" cx="${x(tFim)}" cy="${y(total)}" r="4.5"/>`);
    svg.push(`<text class="lbl-pri" x="${x(tFim) + 8}" y="${y(total) + 16}">Término ~${fmt(tFim)}</text>`);
  }
  svg.push(`<text class="lbl-pri" x="${x(tHoje) - 8}" y="${y(feitos) - 10}" text-anchor="end">${feitos} concluídos</text>`);

  // camada de hover
  svg.push(`<line id="cross" class="cross" y1="${m.top}" y2="${m.top + ph}" visibility="hidden"/>`);
  svg.push(`<circle id="crossPt" class="ponto" r="4.5" visibility="hidden"/>`);
  svg.push(`<rect id="hit" x="${m.left}" y="${m.top}" width="${pw}" height="${ph}" fill="transparent"/>`);

  // Tabela (acessibilidade / leitura exata)
  const linhasTabela = [];
  const marcos = [];
  let anterior = null;
  for (const [t, v] of real) {
    const k = fmtLongo(t);
    if (anterior && anterior.k === k) anterior.v = v; else marcos.push(anterior = { k, v, tipo: "Realizado" });
  }
  if (estimativa) marcos.push({ k: fmtLongo(tFim), v: total, tipo: "Estimativa" });
  if (tPrazo) marcos.push({ k: fmtLongo(tPrazo), v: "—", tipo: "Prazo" });
  for (const r of marcos) linhasTabela.push(`<tr><td>${r.k}</td><td>${r.tipo}</td><td>${r.v}</td></tr>`);

  const dados = JSON.stringify({ real, estimativa, t0, tMax, yMax, m, pw, ph, tHoje, total });

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Burn-up do projeto</title>
<style>
  :root {
    color-scheme: light;
    --page: #f9f9f7; --surface: #fcfcfb; --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
    --grid: #e1e0d9; --axis: #c3c2b7; --serie: #2a78d6; --border: rgba(11,11,11,0.10);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --page: #0d0d0d; --surface: #1a1a19; --ink: #f0efec; --ink-2: #c3c2b7; --muted: #898781;
      --grid: #2c2c2a; --axis: #383835; --serie: #3987e5; --border: rgba(255,255,255,0.10);
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --page: #0d0d0d; --surface: #1a1a19; --ink: #f0efec; --ink-2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --axis: #383835; --serie: #3987e5; --border: rgba(255,255,255,0.10);
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 16px; background: var(--page); color: var(--ink);
         font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .card { max-width: 820px; margin: 0 auto; background: var(--surface); border: 1px solid var(--border);
          border-radius: 12px; padding: 20px; position: relative; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { color: var(--ink-2); margin: 0 0 14px; }
  .legenda { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 8px; color: var(--ink-2); font-size: 13px; }
  .legenda span { display: inline-flex; align-items: center; gap: 6px; }
  .legenda svg { overflow: visible; }
  svg.chart { width: 100%; height: auto; display: block; }
  .grid { stroke: var(--grid); stroke-width: 1; }
  .axis { stroke: var(--axis); stroke-width: 1; }
  .tick { fill: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .serie { fill: none; stroke: var(--serie); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .estimada { stroke-dasharray: 6 5; }
  .escopo { stroke: var(--ink-2); stroke-width: 1.5; stroke-dasharray: 2 4; }
  .hoje { stroke: var(--axis); stroke-width: 1; }
  .prazo { stroke: var(--ink); stroke-width: 1.5; stroke-dasharray: 4 3; }
  .ponto { fill: var(--serie); stroke: var(--surface); stroke-width: 2; }
  .ponto.vazio { fill: var(--surface); stroke: var(--serie); }
  .cross { stroke: var(--muted); stroke-width: 1; }
  .lbl-pri { fill: var(--ink); font-size: 12px; font-weight: 600; }
  .lbl-sec { fill: var(--ink-2); font-size: 12px; }
  .lbl-mut { fill: var(--muted); font-size: 11px; }
  #tip { position: absolute; pointer-events: none; background: var(--surface); border: 1px solid var(--border);
         border-radius: 8px; padding: 6px 10px; font-size: 12px; box-shadow: 0 4px 12px rgba(0,0,0,.12);
         opacity: 0; transition: opacity .1s; white-space: nowrap; }
  #tip b { display: block; }
  #tip span { color: var(--ink-2); }
  details { margin-top: 14px; color: var(--ink-2); }
  table { border-collapse: collapse; margin-top: 8px; font-variant-numeric: tabular-nums; }
  td, th { padding: 4px 14px 4px 0; text-align: left; border-bottom: 1px solid var(--grid); }
  th { color: var(--ink); font-weight: 600; }
</style>
</head>
<body>
<div class="card">
  <h1>${esc(titulo)}</h1>
  <p class="sub">Cards concluídos acumulados e projeção até o término. Gerado em ${fmtLongo(tHoje)}.</p>
  <div class="legenda">
    <span><svg width="22" height="4"><line x1="0" x2="22" y1="2" y2="2" stroke="var(--serie)" stroke-width="2"/></svg>Realizado</span>
    ${estimativa ? `<span><svg width="22" height="4"><line x1="0" x2="22" y1="2" y2="2" stroke="var(--serie)" stroke-width="2" stroke-dasharray="6 5"/></svg>Estimativa</span>` : ""}
    <span><svg width="22" height="4"><line x1="0" x2="22" y1="2" y2="2" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="2 4"/></svg>Total de cards</span>
    ${tPrazo ? `<span><svg width="22" height="4"><line x1="0" x2="22" y1="2" y2="2" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="4 3"/></svg>Prazo</span>` : ""}
  </div>
  <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico burn-up: ${feitos} de ${total} cards concluídos${tFim ? `, término previsto em ${fmtLongo(tFim)}` : ""}">
    ${svg.join("\n    ")}
  </svg>
  <div id="tip"></div>
  <details>
    <summary>Ver dados em tabela</summary>
    <table><thead><tr><th>Data</th><th>Tipo</th><th>Cards concluídos</th></tr></thead>
    <tbody>${linhasTabela.join("")}</tbody></table>
  </details>
</div>
<script>
(() => {
  const D = ${dados};
  const svg = document.querySelector("svg.chart"), hit = document.getElementById("hit");
  const cross = document.getElementById("cross"), pt = document.getElementById("crossPt"), tip = document.getElementById("tip");
  const card = document.querySelector(".card");
  const x = t => D.m.left + ((t - D.t0) / (D.tMax - D.t0)) * D.pw;
  const y = v => D.m.top + D.ph - (v / D.yMax) * D.ph;
  const dia = t => new Date(t).toLocaleDateString("pt-BR");
  function valor(t) {
    if (t <= D.tHoje) {
      let v = 0;
      for (const [tt, vv] of D.real) if (tt <= t) v = vv;
      return { v, est: false };
    }
    if (!D.estimativa) return null;
    const [[a, va], [b, vb]] = D.estimativa;
    if (t > b) return { v: D.total, est: true };
    return { v: va + (vb - va) * (t - a) / (b - a), est: true };
  }
  function mover(ev) {
    const r = svg.getBoundingClientRect();
    const sx = (ev.clientX - r.left) * (${W} / r.width);
    const t = D.t0 + ((sx - D.m.left) / D.pw) * (D.tMax - D.t0);
    const res = valor(t);
    if (!res) return esconder();
    const px = x(t), py = y(res.v);
    for (const el of [cross, pt]) el.setAttribute("visibility", "visible");
    cross.setAttribute("x1", px); cross.setAttribute("x2", px);
    pt.setAttribute("cx", px); pt.setAttribute("cy", py);
    tip.innerHTML = "<b>" + dia(t) + "</b><span>" +
      (res.est ? "~" + res.v.toFixed(1) + " cards (estimativa)" : res.v + " cards concluídos") + "</span>";
    const cr = card.getBoundingClientRect(), k = r.width / ${W};
    let left = r.left - cr.left + px * k + 12;
    if (left + tip.offsetWidth > cr.width - 8) left -= tip.offsetWidth + 24;
    tip.style.left = left + "px";
    tip.style.top = (r.top - cr.top + py * k - 40) + "px";
    tip.style.opacity = 1;
  }
  function esconder() {
    for (const el of [cross, pt]) el.setAttribute("visibility", "hidden");
    tip.style.opacity = 0;
  }
  hit.addEventListener("pointermove", mover);
  hit.addEventListener("pointerleave", esconder);
})();
</script>
</body>
</html>
`;
}

module.exports = { gerarGrafico };
