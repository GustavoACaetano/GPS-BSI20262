// PBI-11: envio de e-mails (recuperação de senha).
// Com SMTP_HOST configurado, envia via SMTP (no Docker, o Mailpit captura as mensagens);
// sem ele, apenas registra a mensagem no log da API (útil em desenvolvimento).
import nodemailer from 'nodemailer';

let transporte;

function obterTransporte() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporte;
}

export const correio = {
  async enviar({ para, assunto, texto }) {
    const smtp = obterTransporte();
    if (!smtp) {
      console.log(`[e-mail não enviado: SMTP_HOST ausente]\nPara: ${para}\nAssunto: ${assunto}\n\n${texto}`);
      return;
    }
    await smtp.sendMail({
      from: process.env.EMAIL_REMETENTE || 'GoBeach <nao-responda@gobeach.dev>',
      to: para,
      subject: assunto,
      text: texto,
    });
  },
};
