// PBI-08: validação dos campos do cadastro/edição de ações comunitárias.
// Retorna { dados } com os valores normalizados ou { campos } com uma mensagem por campo inválido.
import { HORA, praiaId, resultado, texto, textoObrigatorio, textoOpcional } from './validacaoComum.js';

const DATA = /^\d{4}-\d{2}-\d{2}$/;
// A Grande Vitória usa o horário de Brasília, sem horário de verão desde 2019.
const FUSO = '-03:00';
const MAX_RECOMENDACOES = 10;
const MAX_ANTECEDENCIA_MS = 2 * 365 * 24 * 60 * 60 * 1000;

// Rejeita datas inexistentes (ex.: 2026-02-30), que o Date "corrigiria" para outro dia.
function dataExiste(data) {
  if (!DATA.test(data)) return false;
  const [ano, mes, dia] = data.split('-').map(Number);
  const utc = new Date(Date.UTC(ano, mes - 1, dia));
  return utc.getUTCFullYear() === ano && utc.getUTCMonth() === mes - 1 && utc.getUTCDate() === dia;
}

function dataHora(corpo, campos, agora) {
  const data = texto(corpo.data);
  const hora = texto(corpo.hora);

  if (!dataExiste(data)) campos.data = 'Informe a data da ação.';
  if (!HORA.test(hora)) campos.hora = 'Informe o horário de início (HH:MM).';
  if (campos.data || campos.hora) return null;

  const instante = new Date(`${data}T${hora}:00${FUSO}`);
  if (instante <= agora) campos.data = 'A ação deve acontecer em uma data futura.';
  else if (instante - agora > MAX_ANTECEDENCIA_MS) campos.data = 'Cadastre ações com até 2 anos de antecedência.';
  return instante;
}

function recomendacoes(corpo, campos) {
  if (corpo.recomendacoes !== undefined && !Array.isArray(corpo.recomendacoes)) {
    campos.recomendacoes = 'Envie as recomendações como uma lista.';
    return [];
  }
  const itens = (corpo.recomendacoes || []).map(texto).filter(Boolean);
  if (itens.length > MAX_RECOMENDACOES) {
    campos.recomendacoes = `Informe no máximo ${MAX_RECOMENDACOES} recomendações.`;
  } else if (itens.some((item) => item.length > 120)) {
    campos.recomendacoes = 'Cada recomendação deve ter no máximo 120 caracteres.';
  }
  return [...new Set(itens)];
}

export function validarAcao(corpo = {}, agora = new Date()) {
  const campos = {};

  const dados = {
    titulo: textoObrigatorio(corpo, 'titulo', 'Título', 160, campos),
    objetivoAmbiental: textoObrigatorio(corpo, 'objetivoAmbiental', 'Objetivo ecológico', 500, campos),
    apoioLocal: textoOpcional(corpo, 'apoioLocal', 'Apoio local', 300, campos),
    descricao: textoOpcional(corpo, 'descricao', 'Descrição', 2000, campos),
    praiaId: praiaId(corpo, campos),
    pontoEncontro: textoObrigatorio(corpo, 'pontoEncontro', 'Ponto de encontro', 160, campos),
    responsavel: textoObrigatorio(corpo, 'responsavel', 'Organização responsável', 120, campos),
    contato: textoObrigatorio(corpo, 'contato', 'Contato', 120, campos),
    recomendacoes: recomendacoes(corpo, campos),
  };
  dados.dataInicio = dataHora(corpo, campos, agora);

  return resultado(campos, dados);
}
