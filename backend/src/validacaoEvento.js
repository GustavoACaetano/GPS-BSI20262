// PBI-07: validação dos campos do cadastro/edição de eventos esportivos.
// Retorna { dados } com os valores normalizados ou { campos } com uma mensagem por campo inválido.
import { dataHoraFutura, praiaId, resultado, textoObrigatorio, textoOpcional } from './validacaoComum.js';

const MAX_VAGAS = 100000;
const MAX_VALOR = 9999.99;

function inscricao(corpo, campos) {
  if (typeof corpo.gratuito !== 'boolean') {
    campos.gratuito = 'Informe se o evento é gratuito ou pago.';
    return { gratuito: null, valorInscricao: null };
  }
  if (corpo.gratuito) return { gratuito: true, valorInscricao: null };

  const valor = Number(corpo.valorInscricao);
  if (corpo.valorInscricao === '' || corpo.valorInscricao == null || !Number.isFinite(valor) || valor <= 0) {
    campos.valorInscricao = 'Informe o valor da inscrição.';
  } else if (valor > MAX_VALOR) {
    campos.valorInscricao = 'O valor da inscrição deve ser de no máximo R$ 9.999,99.';
  }
  return { gratuito: false, valorInscricao: Math.round(valor * 100) / 100 };
}

// Vazio/nulo = sem limite de vagas.
function limiteVagas(corpo, campos) {
  const bruto = corpo.limiteVagas;
  if (bruto === '' || bruto == null) return null;
  const vagas = Number(bruto);
  if (!Number.isInteger(vagas) || vagas < 1) campos.limiteVagas = 'O limite de vagas deve ser um número inteiro maior que zero.';
  else if (vagas > MAX_VAGAS) campos.limiteVagas = `O limite de vagas deve ser de no máximo ${MAX_VAGAS}.`;
  return vagas;
}

export function validarEvento(corpo = {}, agora = new Date()) {
  const campos = {};

  const dados = {
    titulo: textoObrigatorio(corpo, 'titulo', 'Título', 160, campos),
    modalidade: textoObrigatorio(corpo, 'modalidade', 'Modalidade', 60, campos),
    descricao: textoOpcional(corpo, 'descricao', 'Descrição', 2000, campos),
    regulamento: textoObrigatorio(corpo, 'regulamento', 'Regulamento', 5000, campos),
    praiaId: praiaId(corpo, campos),
    localDetalhe: textoObrigatorio(corpo, 'localDetalhe', 'Local na praia', 160, campos),
    responsavel: textoObrigatorio(corpo, 'responsavel', 'Organizador do evento', 120, campos),
    contato: textoObrigatorio(corpo, 'contato', 'Contato', 120, campos),
    limiteVagas: limiteVagas(corpo, campos),
    ...inscricao(corpo, campos),
  };
  dados.dataInicio = dataHoraFutura(corpo, campos, agora, 'o evento', 'eventos');

  return resultado(campos, dados);
}
