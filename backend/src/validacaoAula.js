// PBI-06: validação dos campos do cadastro/edição de aulas.
// Retorna { dados } com os valores normalizados ou { campos } com uma mensagem por campo inválido.

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

function textoObrigatorio(corpo, campo, rotulo, maximo, campos) {
  const valor = texto(corpo[campo]);
  if (!valor) campos[campo] = `${rotulo} é obrigatório.`;
  else if (valor.length > maximo) campos[campo] = `${rotulo} deve ter no máximo ${maximo} caracteres.`;
  return valor;
}

function textoOpcional(corpo, campo, rotulo, maximo, campos) {
  const valor = texto(corpo[campo]);
  if (valor.length > maximo) campos[campo] = `${rotulo} deve ter no máximo ${maximo} caracteres.`;
  return valor || null;
}

export function validarAula(corpo = {}) {
  const campos = {};

  const titulo = textoObrigatorio(corpo, 'titulo', 'Título', 160, campos);
  const modalidade = textoObrigatorio(corpo, 'modalidade', 'Modalidade', 60, campos);
  const instrutor = textoObrigatorio(corpo, 'instrutor', 'Instrutor', 120, campos);
  const contato = textoObrigatorio(corpo, 'contato', 'Contato', 120, campos);
  const localDetalhe = textoOpcional(corpo, 'localDetalhe', 'Local na praia', 160, campos);
  const descricao = textoOpcional(corpo, 'descricao', 'Descrição', 2000, campos);

  const praiaId = Number(corpo.praiaId);
  if (!Number.isInteger(praiaId) || praiaId <= 0) campos.praiaId = 'Selecione a praia.';

  const dias = Array.isArray(corpo.diasSemana) ? corpo.diasSemana : [];
  if (dias.length === 0) {
    campos.diasSemana = 'Selecione ao menos um dia da semana.';
  } else if (dias.some((dia) => !DIAS_SEMANA.includes(dia))) {
    campos.diasSemana = `Dias válidos: ${DIAS_SEMANA.join(', ')}.`;
  }

  const horaInicio = texto(corpo.horaInicio);
  const horaFim = texto(corpo.horaFim);
  if (!HORA.test(horaInicio)) campos.horaInicio = 'Informe o horário de início (HH:MM).';
  if (!HORA.test(horaFim)) campos.horaFim = 'Informe o horário de término (HH:MM).';
  else if (!campos.horaInicio && horaFim <= horaInicio) {
    campos.horaFim = 'O término deve ser depois do início.';
  }

  if (Object.keys(campos).length > 0) return { campos };

  return {
    dados: {
      titulo,
      modalidade,
      instrutor,
      contato,
      localDetalhe,
      descricao,
      praiaId,
      // Ordem canônica e sem repetição, no mesmo formato da carga inicial ("Ter, Qui, Sáb").
      diasSemana: DIAS_SEMANA.filter((dia) => dias.includes(dia)).join(', '),
      horaInicio,
      horaFim,
    },
  };
}
