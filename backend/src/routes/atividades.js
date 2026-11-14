import { Router } from 'express';
import { query } from '../db.js';
import { validarAula } from '../validacaoAula.js';
import { exigirLogin } from '../autenticacao.js';
import { mesmoSegredo } from '../seguranca.js';

const router = Router();

export const TIPOS = ['AULA', 'EVENTO', 'ACAO_COMUNITARIA'];

// Ordenações permitidas por tipo (PBI-03: modalidade/praia; PBI-04 e PBI-05: cronológica).
const ORDENACOES = {
  AULA: {
    padrao: 'modalidade',
    opcoes: {
      modalidade: 'a.modalidade, a.titulo',
      praia: 'p.nome, a.modalidade',
    },
  },
  EVENTO: { padrao: 'data', opcoes: { data: 'a.data_inicio, a.titulo' } },
  ACAO_COMUNITARIA: { padrao: 'data', opcoes: { data: 'a.data_inicio, a.titulo' } },
};

const SQL_ATIVIDADE = `
  SELECT a.*, p.nome AS praia_nome, p.municipio AS praia_municipio,
         (SELECT COUNT(*)::int FROM inscricao i WHERE i.atividade_id = a.id) AS interessados
  FROM atividade a
  JOIN praia p ON p.id = a.praia_id
`;

const hora = (valor) => (valor ? valor.slice(0, 5) : null);

function formatarAtividade(linha) {
  const base = {
    id: linha.id,
    tipo: linha.tipo,
    titulo: linha.titulo,
    descricao: linha.descricao,
    status: linha.status,
    responsavel: linha.responsavel,
    contato: linha.contato,
    praia: { id: linha.praia_id, nome: linha.praia_nome, municipio: linha.praia_municipio },
    localDetalhe: linha.local_detalhe,
    interessados: linha.interessados,
    organizadorId: linha.organizador_id ?? null,
  };

  if (linha.tipo === 'AULA') {
    return {
      ...base,
      modalidade: linha.modalidade,
      instrutor: linha.responsavel,
      diasSemana: linha.dias_semana,
      horaInicio: hora(linha.hora_inicio),
      horaFim: hora(linha.hora_fim),
    };
  }

  if (linha.tipo === 'EVENTO') {
    return {
      ...base,
      modalidade: linha.modalidade,
      dataInicio: linha.data_inicio.toISOString(),
      gratuito: linha.gratuito,
      valorInscricao: linha.valor_inscricao,
    };
  }

  return {
    ...base,
    pontoEncontro: linha.local_detalhe,
    dataInicio: linha.data_inicio.toISOString(),
    objetivoAmbiental: linha.objetivo_ambiental,
    recomendacoes: linha.recomendacoes,
  };
}

// Visão do dono: inclui a situação de publicação.
const formatarDoDono = (linha) => ({ ...formatarAtividade(linha), publicada: linha.publicada });

// PBI-03/04/05: GET /api/atividades?tipo=AULA|EVENTO|ACAO_COMUNITARIA&ordenar=&praia=
// Somente leitura: usuários não autenticados apenas consultam (PBI-04, critério 3).
router.get('/', async (req, res, next) => {
  try {
    const tipo = req.query.tipo;
    if (!TIPOS.includes(tipo)) {
      return res.status(400).json({ erro: `Parâmetro "tipo" deve ser um de: ${TIPOS.join(', ')}.` });
    }

    const ordenacao = ORDENACOES[tipo];
    const chaveOrdem = req.query.ordenar || ordenacao.padrao;
    if (!ordenacao.opcoes[chaveOrdem]) {
      return res.status(400).json({
        erro: `Ordenação inválida para ${tipo}. Use: ${Object.keys(ordenacao.opcoes).join(', ')}.`,
      });
    }

    const parametros = [tipo];
    const filtros = ['a.tipo = $1', 'a.publicada'];

    // Eventos e ações: apenas os próximos (a partir de hoje).
    if (tipo !== 'AULA') {
      filtros.push("a.data_inicio >= date_trunc('day', NOW())");
    }
    if (req.query.praia) {
      const praiaId = Number.parseInt(req.query.praia, 10);
      if (!Number.isInteger(praiaId) || praiaId <= 0) {
        return res.status(400).json({ erro: 'Parâmetro "praia" inválido.' });
      }
      parametros.push(praiaId);
      filtros.push(`a.praia_id = $${parametros.length}`);
    }

    const resultado = await query(
      `${SQL_ATIVIDADE} WHERE ${filtros.join(' AND ')} ORDER BY ${ordenacao.opcoes[chaveOrdem]}`,
      parametros,
    );
    res.json({ dados: resultado.rows.map(formatarAtividade), total: resultado.rowCount });
  } catch (erro) {
    next(erro);
  }
});

function lerId(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ erro: 'Identificador de atividade inválido.' });
    return null;
  }
  return id;
}

// PBI-11: GET /api/atividades/minhas — publicações do organizador logado (inclusive pendentes)
router.get('/minhas', exigirLogin, async (req, res, next) => {
  try {
    const resultado = await query(
      `${SQL_ATIVIDADE} WHERE a.organizador_id = $1 ORDER BY a.tipo, a.titulo`,
      [req.organizador.id],
    );
    res.json({ dados: resultado.rows.map(formatarDoDono), total: resultado.rowCount });
  } catch (erro) {
    next(erro);
  }
});

// PBI-11: GET /api/atividades/minhas/:id — usada na tela de edição (inclusive pendentes)
router.get('/minhas/:id', exigirLogin, async (req, res, next) => {
  try {
    const id = lerId(req, res);
    if (id === null) return;

    const resultado = await query(`${SQL_ATIVIDADE} WHERE a.id = $1 AND a.organizador_id = $2`, [
      id,
      req.organizador.id,
    ]);
    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Publicação não encontrada entre as suas.' });
    }
    res.json(formatarDoDono(resultado.rows[0]));
  } catch (erro) {
    next(erro);
  }
});

// GET /api/atividades/:id (somente atividades publicadas)
router.get('/:id', async (req, res, next) => {
  try {
    const id = lerId(req, res);
    if (id === null) return;

    const resultado = await query(`${SQL_ATIVIDADE} WHERE a.id = $1 AND a.publicada`, [id]);
    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Atividade não encontrada.' });
    }
    res.json(formatarAtividade(resultado.rows[0]));
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// PBI-06: Cadastrar e Publicar Aulas Esportivas (exige login do PBI-11)
//
// A aula pertence ao organizador que a cadastrou; só ele pode editá-la.
// Com MODERAR_CADASTROS=true, novas aulas ficam ocultas até aprovação por quem
// tem o ADMIN_TOKEN; caso contrário, são publicadas imediatamente.
// ---------------------------------------------------------------------------

const moderacaoAtiva = () => process.env.MODERAR_CADASTROS === 'true';

const PRAIA_INEXISTENTE = '23503'; // foreign_key_violation

function responderInvalido(res, campos) {
  res.status(400).json({ erro: 'Revise os campos destacados.', campos });
}

const CAMPOS_AULA = `titulo, descricao, praia_id, responsavel, contato, modalidade,
                     local_detalhe, dias_semana, hora_inicio, hora_fim`;

const valoresAula = (d) => [
  d.titulo, d.descricao, d.praiaId, d.instrutor, d.contato, d.modalidade,
  d.localDetalhe, d.diasSemana, d.horaInicio, d.horaFim,
];

// Junta a linha gravada com a praia para responder no mesmo formato das consultas.
const SQL_COM_PRAIA = (cte) => `
  WITH gravada AS (${cte})
  SELECT g.*, p.nome AS praia_nome, p.municipio AS praia_municipio,
         (SELECT COUNT(*)::int FROM inscricao i WHERE i.atividade_id = g.id) AS interessados
  FROM gravada g
  JOIN praia p ON p.id = g.praia_id
`;

// POST /api/atividades/aulas
router.post('/aulas', exigirLogin, async (req, res, next) => {
  try {
    const { dados, campos } = validarAula(req.body);
    if (campos) return responderInvalido(res, campos);

    const resultado = await query(
      SQL_COM_PRAIA(`
        INSERT INTO atividade (tipo, ${CAMPOS_AULA}, publicada, organizador_id)
        VALUES ('AULA', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `),
      [...valoresAula(dados), !moderacaoAtiva(), req.organizador.id],
    );

    res.status(201).json(formatarDoDono(resultado.rows[0]));
  } catch (erro) {
    if (erro.code === PRAIA_INEXISTENTE) {
      return responderInvalido(res, { praiaId: 'Praia não encontrada.' });
    }
    next(erro);
  }
});

// PUT /api/atividades/aulas/:id  (somente o organizador dono)
router.put('/aulas/:id', exigirLogin, async (req, res, next) => {
  try {
    const id = lerId(req, res);
    if (id === null) return;

    const existente = await query('SELECT tipo, organizador_id FROM atividade WHERE id = $1', [id]);
    if (existente.rowCount === 0 || existente.rows[0].tipo !== 'AULA') {
      return res.status(404).json({ erro: 'Aula não encontrada.' });
    }
    if (existente.rows[0].organizador_id !== req.organizador.id) {
      return res.status(403).json({ erro: 'Só o organizador que cadastrou a aula pode editá-la.' });
    }

    const { dados, campos } = validarAula(req.body);
    if (campos) return responderInvalido(res, campos);

    const resultado = await query(
      SQL_COM_PRAIA(`
        UPDATE atividade
        SET (${CAMPOS_AULA}, atualizado_em) = ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        WHERE id = $11 AND organizador_id = $12
        RETURNING *
      `),
      [...valoresAula(dados), id, req.organizador.id],
    );

    res.json(formatarDoDono(resultado.rows[0]));
  } catch (erro) {
    if (erro.code === PRAIA_INEXISTENTE) {
      return responderInvalido(res, { praiaId: 'Praia não encontrada.' });
    }
    next(erro);
  }
});

// PATCH /api/atividades/:id/publicacao  { publicada: true|false }  (cabeçalho X-Admin-Token)
router.patch('/:id/publicacao', async (req, res, next) => {
  try {
    const id = lerId(req, res);
    if (id === null) return;

    if (!process.env.ADMIN_TOKEN) {
      return res.status(403).json({ erro: 'Moderação não configurada no servidor.' });
    }
    if (!mesmoSegredo(req.get('X-Admin-Token'), process.env.ADMIN_TOKEN)) {
      return res.status(403).json({ erro: 'Token de administração inválido.' });
    }
    if (typeof req.body?.publicada !== 'boolean') {
      return res.status(400).json({ erro: 'Informe "publicada" como true ou false.' });
    }

    const resultado = await query(
      'UPDATE atividade SET publicada = $1 WHERE id = $2 RETURNING id, publicada',
      [req.body.publicada, id],
    );
    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Atividade não encontrada.' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    next(erro);
  }
});

export default router;
