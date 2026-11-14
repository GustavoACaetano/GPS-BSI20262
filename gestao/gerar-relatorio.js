// Gera o relatório de progresso do quadro do Trello.
//
// Uso: node gestao/gerar-relatorio.js [quadro.json] [AAAA-MM-DD] [--semanas=N] [--api=URL]
//   quadro.json   export do Trello (padrão: gestao/quadro.json)
//   AAAA-MM-DD    prazo da entrega (opcional)
//   --semanas=N   semanas efetivamente trabalhadas (padrão: semanas em que algum card foi concluído)
//   --api=URL     endereço da API do GoBeach (ex.: http://localhost:3000); inclui as metas do MVP
//                 (inscrições, atividades e satisfação, PBI-14) lidas de /api/metricas
//
// O resultado é exibido no terminal e salvo em gestao/relatorios/relatorio-DD-MM-AAAA.txt
const fs = require("fs");
const path = require("path");
const { gerarGrafico } = require("./grafico");

const args = process.argv.slice(2);
const argQuadro = args.find(a => a.toLowerCase().endsWith(".json"));
const argPrazo = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
const argSemanas = Number((args.find(a => a.startsWith("--semanas=")) || "").split("=")[1]) || null;
const argApi = (args.find(a => a.startsWith("--api=")) || "").slice("--api=".length).replace(/\/+$/, "") || null;

const arquivoQuadro = argQuadro ? path.resolve(argQuadro) : path.join(__dirname, "quadro.json");
const board = JSON.parse(fs.readFileSync(arquivoQuadro, "utf-8"));

const linhas = [];
const out = (s = "") => linhas.push(s);

const listas = Object.fromEntries(
  board.lists.filter(l => !l.closed).map(l => [l.id, l.name])
);
const cards = board.cards.filter(c => !c.closed && c.idList in listas);

// Lista final: basta o nome conter este texto (ignora maiúsculas, acentos e emojis)
const LISTA_CONCLUIDO = "Concluido";
const normalizar = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ehConcluido = nome => normalizar(nome).includes(normalizar(LISTA_CONCLUIDO));

const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : "0.0") + "%";

const total = cards.length;
const feitos = cards.filter(c => ehConcluido(listas[c.idList])).length;
out(`Cards: ${feitos}/${total} = ${pct(feitos, total)}`);
out();

// Distribuição por lista
for (const [lid, nome] of Object.entries(listas)) {
  const n = cards.filter(c => c.idList === lid).length;
  out(`  ${nome.padEnd(25)} ${String(n).padStart(3)}  (${pct(n, total)})`);
}

// Progresso pelos checklists
const itens = cards.reduce((s, c) => s + c.badges.checkItems, 0);
const marcados = cards.reduce((s, c) => s + c.badges.checkItemsChecked, 0);
if (itens) {
  out();
  out(`Itens de checklist: ${marcados}/${itens} = ${pct(marcados, itens)}`);
}

// ---------- Estimativa de término ----------
const DIA = 24 * 60 * 60 * 1000;
const fmt = d => d.toLocaleDateString("pt-BR");
const criadoEm = c => new Date(parseInt(c.id.slice(0, 8), 16) * 1000); // timestamp embutido no id

// Data em que cada card foi movido para a lista final (pelo histórico de ações).
// Se o histórico não tiver o movimento, usa a última atividade do card.
const concluidoEm = {};
for (const a of board.actions || []) {
  if (a.type === "updateCard" && ehConcluido(a.data?.listAfter?.name)) {
    const id = a.data.card.id, d = new Date(a.date);
    if (!concluidoEm[id] || d > concluidoEm[id]) concluidoEm[id] = d;
  }
}
const datasConclusao = cards
  .filter(c => ehConcluido(listas[c.idList]))
  .map(c => concluidoEm[c.id] || new Date(c.dateLastActivity));

const hoje = new Date();
const inicio = new Date(Math.min(...cards.map(c => criadoEm(c).getTime())));
const prazo = argPrazo ? new Date(argPrazo + "T23:59:59") : null;
let fim = null; // término previsto
out();
out("--- Estimativa ---");
const restantes = total - feitos;
if (!feitos) {
  out("Nenhum card concluído ainda: não há ritmo para estimar.");
} else {
  const semanaDe = d => Math.floor((d.getTime() / DIA + 3) / 7); // nº da semana (segunda a domingo)
  const semanasComEntrega = new Set(datasConclusao.map(semanaDe)).size;
  const semanas = argSemanas || semanasComEntrega;
  const ritmo = feitos / semanas; // cards por semana trabalhada

  out(`Projeto criado em: ${fmt(inicio)}`);
  out(`Semanas trabalhadas: ${semanas}` +
      (argSemanas ? " (informado)" : " (semanas com cards concluídos; use --semanas=N para ajustar)"));
  out(`Ritmo: ${ritmo.toFixed(1)} cards/semana trabalhada`);
  out(`Restantes: ${restantes} cards`);

  const semanasFaltando = restantes / ritmo;
  out(`Faltam ~${semanasFaltando.toFixed(1)} semana(s) de trabalho nesse ritmo`);
  fim = new Date(hoje.getTime() + semanasFaltando * 7 * DIA);
  out(`Término previsto, trabalhando toda semana a partir de hoje: ${fmt(fim)}`);

  if (prazo) {
    const semanasAtePrazo = (prazo - hoje) / (7 * DIA);
    out();
    if (semanasAtePrazo <= 0) {
      out(`Prazo ${fmt(prazo)} já passou.`);
    } else {
      out(`Prazo: ${fmt(prazo)} (${semanasAtePrazo.toFixed(1)} semanas a partir de hoje)`);
      out(`Semanas de trabalho necessárias: ${semanasFaltando.toFixed(1)}`);
      out(semanasFaltando <= semanasAtePrazo
        ? "=> Dá para cumprir o prazo, desde que trabalhem nesse ritmo nas semanas necessárias."
        : "=> Mesmo trabalhando toda semana nesse ritmo, o prazo NÃO será cumprido.");
    }
  }
}

// ---------- Metas do MVP (opcional: --api=URL) ----------
// Lê /api/metricas: inscrições (meta 100), atividades publicadas (meta 30) e satisfação (meta 80%, PBI-14).
async function metasDoMvp(url) {
  out();
  out("--- Metas do MVP ---");
  try {
    const resposta = await fetch(`${url}/api/metricas`);
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const m = await resposta.json();
    const situacao = (atingida) => (atingida ? "atingida" : "pendente");
    out(`Inscrições: ${m.inscricoes}/${m.metas.inscricoes} (${situacao(m.inscricoes >= m.metas.inscricoes)})`);
    out(`Atividades publicadas: ${m.atividades}/${m.metas.atividades} (${situacao(m.atividades >= m.metas.atividades)})`);
    const s = m.satisfacao;
    if (!s || !s.avaliacoes) {
      out(`Satisfação: nenhuma avaliação ainda (meta: ${s ? s.meta : 80}% de notas 4 e 5)`);
    } else {
      out(`Satisfação: ${s.percentualPositivo}% de avaliações positivas (notas 4 e 5) em ${s.avaliacoes} ` +
          `avaliação(ões), média ${s.media} — meta ${s.meta}% (${situacao(s.metaAtingida)})`);
    }
  } catch (erro) {
    out(`Não foi possível ler as métricas em ${url}/api/metricas (${erro.message}).`);
  }
}

// ---------- Saída ----------
(async () => {
if (argApi) await metasDoMvp(argApi);

const texto = linhas.join("\n");
console.log(texto);

const pastaRelatorios = path.join(__dirname, "relatorios");
fs.mkdirSync(pastaRelatorios, { recursive: true });
const dd = String(hoje.getDate()).padStart(2, "0");
const mm = String(hoje.getMonth() + 1).padStart(2, "0");
const sufixo = `${dd}-${mm}-${hoje.getFullYear()}`;

const arquivo = path.join(pastaRelatorios, `relatorio-${sufixo}.txt`);
fs.writeFileSync(arquivo, texto, "utf-8");
console.log(`\nRelatório salvo em ${path.relative(process.cwd(), arquivo)}`);

const arquivoGrafico = path.join(pastaRelatorios, `grafico-${sufixo}.html`);
fs.writeFileSync(arquivoGrafico, gerarGrafico({
  inicio, hoje, datasConclusao, total, fim, prazo,
  titulo: `Progresso do projeto: ${feitos}/${total} cards (${pct(feitos, total)})`,
}), "utf-8");
console.log(`Gráfico salvo em ${path.relative(process.cwd(), arquivoGrafico)}`);
})();
