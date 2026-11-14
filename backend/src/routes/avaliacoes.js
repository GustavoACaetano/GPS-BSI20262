// PBI-14: Avaliar Utilidade e Enviar Feedback
// Avaliações anônimas de 1 a 5 estrelas; notas 4 e 5 contam como avaliação positiva para a meta de 80%.
import { Router } from 'express';
import { query } from '../db.js';
import { limitarTentativas } from '../limitador.js';
import { mesmoSegredo } from '../seguranca.js';

const router = Router();

export const NOTA_POSITIVA = 4; // notas >= 4 são positivas
export const META_SATISFACAO = 80; // % de avaliações positivas (mini-charter / plano de qualidade)

const QUINZE_MINUTOS = 15 * 60 * 1000;

export function validarAvaliacao(corpo = {}) {
  const campos = {};
  const nota = corpo.nota;
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) campos.nota = 'Escolha de 1 a 5 estrelas.';

  const comentario = typeof corpo.comentario === 'string' ? corpo.comentario.trim() : '';
  if (comentario.length > 1000) campos.comentario = 'O comentário deve ter no máximo 1000 caracteres.';

  // Página de origem: caminho interno ("/explorar") ou um rótulo simples ("inscricao"); senão, ignorada.
  const pagina = typeof corpo.pagina === 'string' && /^[\w/-]{1,200}$/.test(corpo.pagina) ? corpo.pagina : null;

  if (Object.keys(campos).length > 0) return { campos };
  return { dados: { nota, comentario: comentario || null, pagina } };
}

// Resumo usado em /api/metricas e na listagem para a equipe.
export function resumirSatisfacao({ total, positivas, media }) {
  const percentual = total ? Math.round((positivas / total) * 1000) / 10 : null;
  return {
    avaliacoes: total,
    positivas,
    media: media == null ? null : Math.round(Number(media) * 10) / 10,
    percentualPositivo: percentual,
    meta: META_SATISFACAO,
    metaAtingida: percentual != null && percentual >= META_SATISFACAO,
  };
}

export const SQL_SATISFACAO = `
  SELECT COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE nota >= ${NOTA_POSITIVA})::int AS positivas,
         AVG(nota) AS media
  FROM avaliacao`;

// POST /api/avaliacoes  { nota: 1..5, comentario?, pagina? }
router.post(
  '/avaliacoes',
  limitarTentativas({ nome: 'avaliacao', maximo: 5, janelaMs: QUINZE_MINUTOS }),
  async (req, res, next) => {
    try {
      const { dados, campos } = validarAvaliacao(req.body);
      if (campos) return res.status(400).json({ erro: 'Revise os campos destacados.', campos });

      const resultado = await query(
        'INSERT INTO avaliacao (nota, comentario, pagina) VALUES ($1, $2, $3) RETURNING id, criado_em',
        [dados.nota, dados.comentario, dados.pagina],
      );
      res.status(201).json({
        id: resultado.rows[0].id,
        mensagem: 'Obrigado pela avaliação! Ela ajuda a melhorar o GoBeach.',
      });
    } catch (erro) {
      next(erro);
    }
  },
);

// GET /api/avaliacoes  (cabeçalho X-Admin-Token) — resumo e as avaliações mais recentes, para a equipe
router.get('/avaliacoes', async (req, res, next) => {
  try {
    if (!process.env.ADMIN_TOKEN) {
      return res.status(403).json({ erro: 'Acesso da equipe não configurado no servidor.' });
    }
    if (!mesmoSegredo(req.get('X-Admin-Token'), process.env.ADMIN_TOKEN)) {
      return res.status(403).json({ erro: 'Token de administração inválido.' });
    }

    const [resumo, distribuicao, recentes] = await Promise.all([
      query(SQL_SATISFACAO),
      query('SELECT nota, COUNT(*)::int AS quantidade FROM avaliacao GROUP BY nota'),
      query('SELECT id, nota, comentario, pagina, criado_em FROM avaliacao ORDER BY criado_em DESC, id DESC LIMIT 200'),
    ]);
    const porNota = Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, 0]));
    for (const { nota, quantidade } of distribuicao.rows) porNota[nota] = quantidade;

    res.json({
      resumo: resumirSatisfacao(resumo.rows[0]),
      porNota,
      dados: recentes.rows.map((a) => ({
        id: a.id,
        nota: a.nota,
        comentario: a.comentario,
        pagina: a.pagina,
        criadoEm: a.criado_em.toISOString(),
      })),
    });
  } catch (erro) {
    next(erro);
  }
});

export default router;
