// PBI-10: Demonstrar Interesse ou Inscrever-se
import { Router } from 'express';
import { query } from '../db.js';
import { exigirLogin } from '../autenticacao.js';
import { limitarTentativas } from '../limitador.js';
import { validarInscricao } from '../validacaoInscricao.js';
import { resumirSatisfacao, SQL_SATISFACAO } from './avaliacoes.js';

const router = Router();

const QUINZE_MINUTOS = 15 * 60 * 1000;
export const METAS_MVP = { inscricoes: 100, atividades: 30 };

function lerId(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ erro: 'Identificador de atividade inválido.' });
    return null;
  }
  return id;
}

// Explica por que a inscrição não entrou quando o UPDATE não encontrou vaga.
async function motivoRecusa(id) {
  const resultado = await query(
    `SELECT publicada, status, tipo, data_inicio <= NOW() AS encerrada, limite_vagas, inscritos
     FROM atividade WHERE id = $1`,
    [id],
  );
  const a = resultado.rows[0];
  if (!a || !a.publicada) return [404, { erro: 'Atividade não encontrada.' }];
  if (a.status === 'CANCELADO') {
    return [409, { erro: 'Esta atividade foi cancelada pelo organizador.', motivo: 'CANCELADA' }];
  }
  if (a.tipo !== 'AULA' && a.encerrada) {
    return [409, { erro: 'As inscrições foram encerradas: a atividade já aconteceu.', motivo: 'ENCERRADA' }];
  }
  return [409, { erro: 'As vagas desta atividade estão esgotadas.', motivo: 'ESGOTADA' }];
}

// POST /api/atividades/:id/inscricoes  { nome, contato, consentimento: true }
router.post(
  '/atividades/:id/inscricoes',
  limitarTentativas({ nome: 'inscricao', maximo: 20, janelaMs: QUINZE_MINUTOS }),
  async (req, res, next) => {
    try {
      const id = lerId(req, res);
      if (id === null) return;

      const { dados, campos } = validarInscricao(req.body);
      if (campos) return res.status(400).json({ erro: 'Revise os campos destacados.', campos });

      // Um único comando: ocupa a vaga (se houver) e grava a inscrição. Se o contato já estiver
      // inscrito, a violação de unicidade desfaz o comando inteiro, inclusive o contador.
      const resultado = await query(
        `WITH vaga AS (
           UPDATE atividade SET inscritos = inscritos + 1
           WHERE id = $1 AND publicada AND status <> 'CANCELADO'
             AND (tipo = 'AULA' OR data_inicio > NOW())
             AND (limite_vagas IS NULL OR inscritos < limite_vagas)
           RETURNING id, inscritos, limite_vagas
         ), nova AS (
           INSERT INTO inscricao (atividade_id, nome, contato, contato_normalizado)
           SELECT id, $2, $3, $4 FROM vaga
           RETURNING id, nome, criado_em
         )
         SELECT nova.id, nova.nome, nova.criado_em, vaga.inscritos, vaga.limite_vagas
         FROM nova, vaga`,
        [id, dados.nome, dados.contato, dados.contatoNormalizado],
      );

      if (resultado.rowCount === 0) {
        const [status, corpo] = await motivoRecusa(id);
        return res.status(status).json(corpo);
      }

      const linha = resultado.rows[0];
      res.status(201).json({
        inscricao: { id: linha.id, nome: linha.nome, criadoEm: linha.criado_em.toISOString() },
        interessados: linha.inscritos,
        vagasRestantes: linha.limite_vagas == null ? null : linha.limite_vagas - linha.inscritos,
      });
    } catch (erro) {
      if (erro.code === '23505' && erro.constraint === 'inscricao_unica') {
        return res.status(409).json({
          erro: 'Este contato já está inscrito nesta atividade.',
          motivo: 'DUPLICADA',
          campos: { contato: 'Este contato já está inscrito nesta atividade.' },
        });
      }
      next(erro);
    }
  },
);

// GET /api/atividades/minhas/:id/inscricoes — inscritos de uma atividade do organizador logado
router.get('/atividades/minhas/:id/inscricoes', exigirLogin, async (req, res, next) => {
  try {
    const id = lerId(req, res);
    if (id === null) return;

    const atividade = await query(
      `SELECT id, tipo, titulo, limite_vagas, inscritos FROM atividade
       WHERE id = $1 AND organizador_id = $2`,
      [id, req.organizador.id],
    );
    if (atividade.rowCount === 0) {
      return res.status(404).json({ erro: 'Publicação não encontrada entre as suas.' });
    }

    const inscricoes = await query(
      'SELECT id, nome, contato, criado_em FROM inscricao WHERE atividade_id = $1 ORDER BY criado_em, id',
      [id],
    );
    const a = atividade.rows[0];
    res.json({
      atividade: { id: a.id, tipo: a.tipo, titulo: a.titulo, limiteVagas: a.limite_vagas, inscritos: a.inscritos },
      dados: inscricoes.rows.map((i) => ({
        id: i.id,
        nome: i.nome,
        contato: i.contato,
        criadoEm: i.criado_em.toISOString(),
      })),
      total: inscricoes.rowCount,
    });
  } catch (erro) {
    next(erro);
  }
});

// GET /api/metricas — acompanhamento das metas do MVP (100+ inscrições, 30+ atividades publicadas)
// PBI-14: + satisfação (meta de 80% de avaliações positivas, notas 4 e 5).
router.get('/metricas', async (_req, res, next) => {
  try {
    const [resultado, satisfacao] = await Promise.all([
      query(
        `SELECT (SELECT COUNT(*)::int FROM inscricao) AS inscricoes,
                (SELECT COUNT(*)::int FROM atividade WHERE publicada) AS atividades`,
      ),
      query(SQL_SATISFACAO),
    ]);
    res.json({
      ...resultado.rows[0],
      metas: METAS_MVP,
      satisfacao: resumirSatisfacao(satisfacao.rows[0]),
    });
  } catch (erro) {
    next(erro);
  }
});

export default router;
