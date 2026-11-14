// Limite simples de tentativas por IP (em memória), contra força bruta no login
// e abuso do envio de e-mails de recuperação. Suficiente para uma instância única.
const contadores = new Map();

export function limitarTentativas({ nome, maximo, janelaMs }) {
  return (req, res, next) => {
    const chave = `${nome}:${req.ip}`;
    const agora = Date.now();
    const atual = contadores.get(chave);
    if (!atual || atual.reiniciaEm <= agora) {
      contadores.set(chave, { total: 1, reiniciaEm: agora + janelaMs });
      return next();
    }
    if (atual.total >= maximo) {
      res.set('Retry-After', String(Math.ceil((atual.reiniciaEm - agora) / 1000)));
      return res.status(429).json({ erro: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' });
    }
    atual.total += 1;
    next();
  };
}

export const limparLimites = () => contadores.clear();
