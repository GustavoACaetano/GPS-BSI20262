// PBI-11: sessões de organizadores.
// O token vai no cabeçalho "Authorization: Bearer <token>"; o banco guarda só o hash.
import { query } from './db.js';
import { gerarToken, hashToken } from './seguranca.js';

export const DURACAO_SESSAO_DIAS = 7;

export async function criarSessao(organizadorId) {
  const token = gerarToken();
  await query(
    `INSERT INTO sessao (token_hash, organizador_id, expira_em)
     VALUES ($1, $2, NOW() + make_interval(days => $3))`,
    [hashToken(token), organizadorId, DURACAO_SESSAO_DIAS],
  );
  return token;
}

export function lerToken(req) {
  const [esquema, token] = (req.get('Authorization') || '').split(' ');
  return esquema === 'Bearer' && token ? token : null;
}

export const formatarOrganizador = (linha) => ({
  id: linha.id,
  nome: linha.nome,
  email: linha.email,
  telefone: linha.telefone,
});

// Middleware: exige sessão válida e coloca o organizador em req.organizador.
export async function exigirLogin(req, res, next) {
  try {
    const token = lerToken(req);
    if (!token) {
      return res.status(401).json({ erro: 'Faça login para continuar.' });
    }
    const resultado = await query(
      `SELECT o.id, o.nome, o.email, o.telefone
       FROM sessao s JOIN organizador o ON o.id = s.organizador_id
       WHERE s.token_hash = $1 AND s.expira_em > NOW()`,
      [hashToken(token)],
    );
    if (resultado.rowCount === 0) {
      return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    }
    req.organizador = formatarOrganizador(resultado.rows[0]);
    req.tokenSessao = token;
    next();
  } catch (erro) {
    next(erro);
  }
}
