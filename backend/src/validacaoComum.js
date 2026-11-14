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

export const resultado = (campos, dados) => (Object.keys(campos).length > 0 ? { campos } : { dados });
