// PBI-09: filtros combinados da busca de atividades (categoria + praia + município + modalidade + período).
// Converte a query string em condições SQL parametrizadas, ou devolve { erro } se algum filtro for inválido.
import { DIAS_LIMITE_ATUALIZACAO } from './balneabilidade.js';
import { DIAS_SEMANA } from './validacaoAula.js';

export const TIPOS = ['AULA', 'EVENTO', 'ACAO_COMUNITARIA'];
export const MUNICIPIOS = ['Vitória', 'Vila Velha', 'Serra', 'Guarapari'];

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PERIODO_DIAS = 366;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

// Também rejeita datas inexistentes (2026-02-30 viraria 02/03; 2026-13-01 é inválida).
function dataValida(texto) {
  if (!DATA.test(texto)) return false;
  const data = new Date(`${texto}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto;
}

// Dias da semana (Seg..Dom) que existem entre duas datas 'YYYY-MM-DD', inclusive.
export function diasDaSemanaNoPeriodo(de, ate) {
  const inicio = new Date(`${de}T12:00:00Z`);
  const fim = new Date(`${ate}T12:00:00Z`);
  const dias = new Set();
  for (let d = inicio; d <= fim && dias.size < 7; d = new Date(d.getTime() + UM_DIA_MS)) {
    // getUTCDay: 0 = domingo; DIAS_SEMANA começa na segunda.
    dias.add(DIAS_SEMANA[(d.getUTCDay() + 6) % 7]);
  }
  return DIAS_SEMANA.filter((dia) => dias.has(dia));
}

export function montarFiltros(query = {}) {
  const parametros = [];
  const p = (valor) => {
    parametros.push(valor);
    return `$${parametros.length}`;
  };
  const filtros = ['a.publicada'];

  // Categorias: lista separada por vírgula; vazia = todas.
  const categorias = String(query.categorias || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  if (categorias.some((c) => !TIPOS.includes(c))) {
    return { erro: `Categorias válidas: ${TIPOS.join(', ')}.` };
  }
  const tipos = categorias.length ? [...new Set(categorias)] : TIPOS;
  filtros.push(`a.tipo = ANY(${p(tipos)}::tipo_atividade[])`);

  // Eventos e ações: só os próximos (a partir de hoje), como nas abas de consulta.
  filtros.push("(a.tipo = 'AULA' OR a.data_inicio >= date_trunc('day', NOW()))");

  if (query.praia) {
    const praiaId = Number(query.praia);
    if (!Number.isInteger(praiaId) || praiaId <= 0) return { erro: 'Parâmetro "praia" inválido.' };
    filtros.push(`a.praia_id = ${p(praiaId)}`);
  }

  if (query.municipio) {
    if (!MUNICIPIOS.includes(query.municipio)) {
      return { erro: `Município deve ser um de: ${MUNICIPIOS.join(', ')}.` };
    }
    filtros.push(`p.municipio = ${p(query.municipio)}`);
  }

  if (query.modalidade) {
    const modalidade = String(query.modalidade).trim();
    if (modalidade.length > 60) return { erro: 'Parâmetro "modalidade" inválido.' };
    // Ações comunitárias não têm modalidade e, por isso, saem do resultado.
    filtros.push(`LOWER(TRIM(a.modalidade)) = LOWER(${p(modalidade)})`);
  }

  // Período (horário de Brasília). Eventos e ações: data dentro do intervalo.
  // Aulas são semanais: entram se acontecem em algum dia da semana coberto pelo período.
  if (query.de || query.ate) {
    const de = String(query.de || '');
    const ate = String(query.ate || '');
    if (!dataValida(de) || !dataValida(ate)) {
      return { erro: 'Informe "de" e "ate" no formato AAAA-MM-DD.' };
    }
    if (ate < de) return { erro: 'A data final deve ser igual ou posterior à inicial.' };
    if ((new Date(ate) - new Date(de)) / UM_DIA_MS > MAX_PERIODO_DIAS) {
      return { erro: 'O período pode ter no máximo 1 ano.' };
    }
    const inicio = p(`${de}T00:00:00-03:00`);
    const fim = p(`${ate}T23:59:59.999-03:00`);
    const dias = p(diasDaSemanaNoPeriodo(de, ate));
    filtros.push(
      `(CASE WHEN a.tipo = 'AULA' THEN string_to_array(a.dias_semana, ', ') && ${dias}::text[]
             ELSE a.data_inicio BETWEEN ${inicio}::timestamptz AND ${fim}::timestamptz END)`,
    );
  }

  // Balneabilidade: só praias cujo último boletim válido é "Própria" e está em dia (até 7 dias).
  if (query.propria === 'true') {
    filtros.push(`EXISTS (
      SELECT 1 FROM (
        SELECT b.status, b.data_boletim FROM boletim_balneabilidade b
        WHERE b.praia_id = a.praia_id AND b.data_coleta IS NOT NULL AND b.fonte IS NOT NULL
        ORDER BY b.data_boletim DESC LIMIT 1
      ) ultimo
      WHERE ultimo.status = 'PROPRIA'
        AND ultimo.data_boletim > NOW() - make_interval(days => ${p(DIAS_LIMITE_ATUALIZACAO + 1)})
    )`);
  }

  return { filtros, parametros, tipos };
}
