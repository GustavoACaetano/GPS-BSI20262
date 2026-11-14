// PBI-08: validação dos campos do cadastro/edição de ações comunitárias.
// Retorna { dados } com os valores normalizados ou { campos } com uma mensagem por campo inválido.
import { dataHoraFutura, praiaId, resultado, texto, textoObrigatorio, textoOpcional } from './validacaoComum.js';

const MAX_RECOMENDACOES = 10;

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
  dados.dataInicio = dataHoraFutura(corpo, campos, agora, 'a ação', 'ações');

  return resultado(campos, dados);
}
