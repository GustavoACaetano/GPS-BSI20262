// Regras de validação compartilhadas pelos cadastros de atividades (PBI-06, PBI-08).
// Cada função grava em `campos` a mensagem do campo inválido e devolve o valor normalizado.

export const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

export function textoObrigatorio(corpo, campo, rotulo, maximo, campos) {
  const valor = texto(corpo[campo]);
  if (!valor) campos[campo] = `${rotulo} é obrigatório.`;
  else if (valor.length > maximo) campos[campo] = `${rotulo} deve ter no máximo ${maximo} caracteres.`;
  return valor;
}

export function textoOpcional(corpo, campo, rotulo, maximo, campos) {
  const valor = texto(corpo[campo]);
  if (valor.length > maximo) campos[campo] = `${rotulo} deve ter no máximo ${maximo} caracteres.`;
  return valor || null;
}

export function praiaId(corpo, campos) {
  const id = Number(corpo.praiaId);
  if (!Number.isInteger(id) || id <= 0) campos.praiaId = 'Selecione a praia.';
  return id;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
// A Grande Vitória usa o horário de Brasília, sem horário de verão desde 2019.
const FUSO = '-03:00';
const MAX_ANTECEDENCIA_MS = 2 * 365 * 24 * 60 * 60 * 1000;

// Rejeita datas inexistentes (ex.: 2026-02-30), que o Date "corrigiria" para outro dia.
function dataExiste(data) {
  if (!DATA.test(data)) return false;
  const [ano, mes, dia] = data.split('-').map(Number);
  const utc = new Date(Date.UTC(ano, mes - 1, dia));
  return utc.getUTCFullYear() === ano && utc.getUTCMonth() === mes - 1 && utc.getUTCDate() === dia;
}

// Campos "data" (AAAA-MM-DD) e "hora" (HH:MM) no horário de Brasília -> Date futuro, com até 2 anos
// de antecedência. Usado por ações (PBI-08) e eventos (PBI-07); `singular` = "a ação", `plural` = "ações".
export function dataHoraFutura(corpo, campos, agora, singular, plural) {
  const data = texto(corpo.data);
  const hora = texto(corpo.hora);

  if (!dataExiste(data)) campos.data = `Informe a data d${singular}.`;
  if (!HORA.test(hora)) campos.hora = 'Informe o horário de início (HH:MM).';
  if (campos.data || campos.hora) return null;

  const instante = new Date(`${data}T${hora}:00${FUSO}`);
  const nome = singular.charAt(0).toUpperCase() + singular.slice(1);
  if (instante <= agora) campos.data = `${nome} deve acontecer em uma data futura.`;
  else if (instante - agora > MAX_ANTECEDENCIA_MS) campos.data = `Cadastre ${plural} com até 2 anos de antecedência.`;
  return instante;
}

export const resultado = (campos, dados) => (Object.keys(campos).length > 0 ? { campos } : { dados });
