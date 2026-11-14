// PBI-06: validação dos campos do cadastro/edição de aulas.
// Retorna { dados } com os valores normalizados ou { campos } com uma mensagem por campo inválido.
import { HORA, praiaId, resultado, texto, textoObrigatorio, textoOpcional } from './validacaoComum.js';

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function validarAula(corpo = {}) {
  const campos = {};

  const dados = {
    titulo: textoObrigatorio(corpo, 'titulo', 'Título', 160, campos),
    modalidade: textoObrigatorio(corpo, 'modalidade', 'Modalidade', 60, campos),
    instrutor: textoObrigatorio(corpo, 'instrutor', 'Instrutor', 120, campos),
    contato: textoObrigatorio(corpo, 'contato', 'Contato', 120, campos),
    localDetalhe: textoOpcional(corpo, 'localDetalhe', 'Local na praia', 160, campos),
    descricao: textoOpcional(corpo, 'descricao', 'Descrição', 2000, campos),
    praiaId: praiaId(corpo, campos),
  };

  const dias = Array.isArray(corpo.diasSemana) ? corpo.diasSemana : [];
  if (dias.length === 0) {
    campos.diasSemana = 'Selecione ao menos um dia da semana.';
  } else if (dias.some((dia) => !DIAS_SEMANA.includes(dia))) {
    campos.diasSemana = `Dias válidos: ${DIAS_SEMANA.join(', ')}.`;
  }
  // Ordem canônica e sem repetição, no mesmo formato da carga inicial ("Ter, Qui, Sáb").
  dados.diasSemana = DIAS_SEMANA.filter((dia) => dias.includes(dia)).join(', ');

  dados.horaInicio = texto(corpo.horaInicio);
  dados.horaFim = texto(corpo.horaFim);
  if (!HORA.test(dados.horaInicio)) campos.horaInicio = 'Informe o horário de início (HH:MM).';
  if (!HORA.test(dados.horaFim)) campos.horaFim = 'Informe o horário de término (HH:MM).';
  else if (!campos.horaInicio && dados.horaFim <= dados.horaInicio) {
    campos.horaFim = 'O término deve ser depois do início.';
  }

  return resultado(campos, dados);
}
