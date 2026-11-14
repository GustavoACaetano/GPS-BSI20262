// PBI-10: validação da inscrição / demonstração de interesse.
// Coleta nome e e-mail ou WhatsApp, e exige o consentimento para compartilhar o contato com o organizador.
import { resultado, texto } from './validacaoComum.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// E-mail em minúsculas ou só os dígitos do telefone (sem o +55), para detectar inscrição repetida.
// Devolve null se o texto não for um e-mail nem um celular/telefone brasileiro com DDD.
export function normalizarContato(valor) {
  const contato = texto(valor);
  if (contato.includes('@')) {
    return EMAIL.test(contato) && contato.length <= 120 ? contato.toLowerCase() : null;
  }
  // Só aceita caracteres comuns em telefones: dígitos, espaço, +, -, ( e ).
  if (!/^[\d\s()+-]+$/.test(contato)) return null;
  let digitos = contato.replace(/\D/g, '');
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) digitos = digitos.slice(2);
  return digitos.length === 10 || digitos.length === 11 ? digitos : null;
}

export function validarInscricao(corpo = {}) {
  const campos = {};

  const nome = texto(corpo.nome);
  if (nome.length < 2) campos.nome = 'Informe seu nome.';
  else if (nome.length > 120) campos.nome = 'O nome deve ter no máximo 120 caracteres.';

  const contato = texto(corpo.contato);
  const contatoNormalizado = normalizarContato(contato);
  if (!contato) campos.contato = 'Informe seu e-mail ou WhatsApp.';
  else if (!contatoNormalizado) campos.contato = 'Informe um e-mail válido ou um WhatsApp com DDD.';

  if (corpo.consentimento !== true) {
    campos.consentimento = 'É preciso autorizar o envio do seu contato ao organizador.';
  }

  return resultado(campos, { nome, contato, contatoNormalizado });
}
