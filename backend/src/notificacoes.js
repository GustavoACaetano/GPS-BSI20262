// PBI-12: aviso por e-mail aos inscritos quando a atividade é adiada ou cancelada.
// Inscritos que deixaram só WhatsApp ficam com o aviso visual (cards e página da atividade).
import { correio } from './email.js';

const ROTULOS = { ADIADO: 'adiada', CANCELADO: 'cancelada' };

export const ehEmail = (contato) => contato.includes('@');

export function mensagemStatus({ titulo, id }, status, aviso, nome) {
  const base = process.env.APP_URL || 'http://localhost:8080';
  return {
    assunto: `GoBeach: "${titulo}" foi ${ROTULOS[status]}`,
    texto:
      `Olá, ${nome}!\n\n` +
      `A atividade "${titulo}", em que você se inscreveu pelo GoBeach, foi ${ROTULOS[status]} pelo organizador.\n\n` +
      `Aviso do organizador: ${aviso}\n\n` +
      `Detalhes atualizados: ${base}/atividades/${id}\n`,
  };
}

// Falhas temporárias: respostas SMTP 4xx (ex.: 451, servidor ocupado ou limite de envio) e quedas de conexão.
const CONEXAO = ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNRESET'];
export const falhaTemporaria = (erro) =>
  (erro.responseCode >= 400 && erro.responseCode < 500) || CONEXAO.includes(erro.code);

const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const ESPERAS_MS = [1000, 3000]; // até 3 tentativas por e-mail

async function enviarComNovasTentativas(mensagem, esperar) {
  for (let tentativa = 0; ; tentativa += 1) {
    try {
      return await correio.enviar(mensagem);
    } catch (erro) {
      if (tentativa >= ESPERAS_MS.length || !falhaTemporaria(erro)) throw erro;
      await esperar(ESPERAS_MS[tentativa]);
    }
  }
}

// Envia em sequência e devolve quantos e-mails saíram; falhas individuais não interrompem os demais.
export async function notificarInscritos(atividade, status, aviso, inscritos, { esperar = pausa } = {}) {
  let enviados = 0;
  for (const { nome, contato } of inscritos.filter((i) => ehEmail(i.contato))) {
    try {
      await enviarComNovasTentativas({ para: contato, ...mensagemStatus(atividade, status, aviso, nome) }, esperar);
      enviados += 1;
    } catch (erro) {
      console.error(`Falha ao avisar ${contato} sobre a atividade ${atividade.id}:`, erro.message);
    }
  }
  return enviados;
}
