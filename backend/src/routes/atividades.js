import { Router } from 'express';
import { query } from '../db.js';
import { validarAula } from '../validacaoAula.js';
import { validarAcao } from '../validacaoAcao.js';
import { validarEvento } from '../validacaoEvento.js';
import { montarFiltros, TIPOS } from '../filtrosExplorar.js';
import { notificarInscritos } from '../notificacoes.js';
import { exigirLogin } from '../autenticacao.js';
import { mesmoSegredo } from '../seguranca.js';

const router = Router();

export { TIPOS };

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
         a.inscritos AS interessados
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
    // PBI-12: aviso do organizador ao adiar/cancelar
    avisoStatus: linha.aviso_status ?? null,
    statusAlteradoEm: linha.status_alterado_em ? new Date(linha.status_alterado_em).toISOString() : null,
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
      regulamento: linha.regulamento ?? null,
      limiteVagas: linha.limite_vagas ?? null,
    };
  }

  return {
    ...base,
    pontoEncontro: linha.local_detalhe,
    dataInicio: linha.data_inicio.toISOString(),
    objetivoAmbiental: linha.objetivo_ambiental,
    apoioLocal: linha.apoio_local ?? null,
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

// PBI-09: GET /api/atividades/explorar?categorias=AULA,EVENTO&praia=&municipio=&modalidade=&de=&ate=&propria=true
// Filtros combinados; devolve a lista e a contagem por categoria (só atividades publicadas).
router.get('/explorar', async (req, res, next) => {
  try {
    const { erro, filtros, parametros, tipos } = montarFiltros(req.query);
    if (erro) return res.status(400).json({ erro });

    const resultado = await query(
      `${SQL_ATIVIDADE} WHERE ${filtros.join(' AND ')}
       ORDER BY a.tipo, a.data_inicio NULLS LAST, a.modalidade, a.titulo`,
      parametros,
    );
    const dados = resultado.rows.map(formatarAtividade);
    const contagem = Object.fromEntries(tipos.map((t) => [t, dados.filter((a) => a.tipo === t).length]));
    res.json({ dados, total: dados.length, contagem });
  } catch (erro) {
    next(erro);
  }
});

// PBI-09: GET /api/atividades/modalidades — modalidades com aulas ou eventos publicados (opções do filtro)
router.get('/modalidades', async (_req, res, next) => {
  try {
    const resultado = await query(
      // Agrupa sem diferenciar maiúsculas ("Surf" e "surf" viram uma opção só); o filtro também ignora caixa.
      `SELECT MIN(TRIM(modalidade)) AS modalidade FROM atividade
       WHERE publicada AND modalidade IS NOT NULL
         AND (tipo = 'AULA' OR data_inicio >= date_trunc('day', NOW()))
       GROUP BY LOWER(TRIM(modalidade))
       ORDER BY 1`,
    );
    res.json({ dados: resultado.rows.map((r) => r.modalidade) });
  } catch (erro) {
    next(erro);
  }
});

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
// Cadastro e edição pelo organizador logado (PBI-11):
//   PBI-06 aulas  -> POST /api/atividades/aulas, PUT /api/atividades/aulas/:id
//   PBI-07 eventos -> POST /api/atividades/eventos, PUT /api/atividades/eventos/:id
//   PBI-08 ações  -> POST /api/atividades/acoes, PUT /api/atividades/acoes/:id
//
// A atividade pertence ao organizador que a cadastrou; só ele pode editá-la.
// Com MODERAR_CADASTROS=true, novos cadastros ficam ocultos até aprovação por quem
// tem o ADMIN_TOKEN; caso contrário, são publicados imediatamente.
// ---------------------------------------------------------------------------

const moderacaoAtiva = () => process.env.MODERAR_CADASTROS === 'true';

const PRAIA_INEXISTENTE = '23503'; // foreign_key_violation

function responderInvalido(res, campos) {
  res.status(400).json({ erro: 'Revise os campos destacados.', campos });
}

// Junta a linha gravada com a praia para responder no mesmo formato das consultas.
const SQL_COM_PRAIA = (cte) => `
  WITH gravada AS (${cte})
  SELECT g.*, p.nome AS praia_nome, p.municipio AS praia_municipio,
         g.inscritos AS interessados
  FROM gravada g
  JOIN praia p ON p.id = g.praia_id
`;

const CADASTROS = [
  {
    tipo: 'AULA',
    caminho: 'aulas',
    artigo: 'a aula',
    naoEncontrada: 'Aula não encontrada.',
    validar: validarAula,
    colunas: ['titulo', 'descricao', 'praia_id', 'responsavel', 'contato', 'modalidade',
      'local_detalhe', 'dias_semana', 'hora_inicio', 'hora_fim'],
    valores: (d) => [d.titulo, d.descricao, d.praiaId, d.instrutor, d.contato, d.modalidade,
      d.localDetalhe, d.diasSemana, d.horaInicio, d.horaFim],
  },
  {
    tipo: 'EVENTO',
    caminho: 'eventos',
    artigo: 'o evento',
    naoEncontrada: 'Evento esportivo não encontrado.',
    validar: (corpo) => validarEvento(corpo),
    colunas: ['titulo', 'descricao', 'praia_id', 'responsavel', 'contato', 'modalidade', 'local_detalhe',
      'data_inicio', 'gratuito', 'valor_inscricao', 'regulamento', 'limite_vagas'],
    valores: (d) => [d.titulo, d.descricao, d.praiaId, d.responsavel, d.contato, d.modalidade, d.localDetalhe,
      d.dataInicio, d.gratuito, d.valorInscricao, d.regulamento, d.limiteVagas],
  },
  {
    tipo: 'ACAO_COMUNITARIA',
    caminho: 'acoes',
    artigo: 'a ação',
    naoEncontrada: 'Ação comunitária não encontrada.',
    validar: (corpo) => validarAcao(corpo),
    colunas: ['titulo', 'descricao', 'praia_id', 'responsavel', 'contato', 'local_detalhe',
      'data_inicio', 'objetivo_ambiental', 'apoio_local', 'recomendacoes'],
    valores: (d) => [d.titulo, d.descricao, d.praiaId, d.responsavel, d.contato, d.pontoEncontro,
      d.dataInicio, d.objetivoAmbiental, d.apoioLocal, d.recomendacoes],
  },
];

const marcadores = (quantidade, inicio = 1) =>
  Array.from({ length: quantidade }, (_, i) => `$${inicio + i}`).join(', ');

for (const cadastro of CADASTROS) {
  const { tipo, caminho, colunas } = cadastro;
  const n = colunas.length;

  router.post(`/${caminho}`, exigirLogin, async (req, res, next) => {
    try {
      const { dados, campos } = cadastro.validar(req.body);
      if (campos) return responderInvalido(res, campos);

      const resultado = await query(
        SQL_COM_PRAIA(`
          INSERT INTO atividade (tipo, ${colunas.join(', ')}, publicada, organizador_id)
          VALUES ('${tipo}', ${marcadores(n + 2)})
          RETURNING *
        `),
        [...cadastro.valores(dados), !moderacaoAtiva(), req.organizador.id],
      );

      res.status(201).json(formatarDoDono(resultado.rows[0]));
    } catch (erro) {
      if (erro.code === PRAIA_INEXISTENTE) {
        return responderInvalido(res, { praiaId: 'Praia não encontrada.' });
      }
      next(erro);
    }
  });

  router.put(`/${caminho}/:id`, exigirLogin, async (req, res, next) => {
    try {
      const id = lerId(req, res);
      if (id === null) return;

      const existente = await query('SELECT tipo, organizador_id, status FROM atividade WHERE id = $1', [id]);
      if (existente.rowCount === 0 || existente.rows[0].tipo !== tipo) {
        return res.status(404).json({ erro: cadastro.naoEncontrada });
      }
      if (existente.rows[0].organizador_id !== req.organizador.id) {
        return res.status(403).json({
          erro: `Só o organizador que cadastrou ${cadastro.artigo} pode ${cadastro.artigo.startsWith('o ') ? 'editá-lo' : 'editá-la'}.`,
        });
      }

      if (existente.rows[0].status === 'CANCELADO') {
        return res.status(409).json({ erro: 'Atividades canceladas não podem ser editadas.' });
      }

      const { dados, campos } = cadastro.validar(req.body);
      if (campos) return responderInvalido(res, campos);

      const resultado = await query(
        SQL_COM_PRAIA(`
          UPDATE atividade
          SET (${colunas.join(', ')}, atualizado_em) = (${marcadores(n)}, NOW())
          WHERE id = $${n + 1} AND organizador_id = $${n + 2} AND status <> 'CANCELADO'
          RETURNING *
        `),
        [...cadastro.valores(dados), id, req.organizador.id],
      );

      res.json(formatarDoDono(resultado.rows[0]));
    } catch (erro) {
      if (erro.code === PRAIA_INEXISTENTE) {
        return responderInvalido(res, { praiaId: 'Praia não encontrada.' });
      }
      // PBI-10: o limite de vagas não pode ficar abaixo do número de inscritos.
      if (erro.code === '23514' && erro.constraint === 'inscritos_dentro_do_limite') {
        return responderInvalido(res, {
          limiteVagas: 'Já há mais inscritos do que esse limite. Informe um número maior ou deixe sem limite.',
        });
      }
      next(erro);
    }
  });
}

// ---------------------------------------------------------------------------
// PBI-12: Atualizar Status ou Cancelar Atividade
// PATCH /api/atividades/:id/status  { status: 'ATIVO' | 'ADIADO' | 'CANCELADO', aviso }
//   - só o organizador dono; adiar/cancelar exige um aviso (5 a 300 caracteres);
//   - o cancelamento é definitivo; atividades já realizadas não mudam de status;
//   - ADIADO -> ATIVO reativa (ex.: depois de definir a nova data na edição).
// Inscritos com e-mail recebem o aviso em segundo plano.
// ---------------------------------------------------------------------------
export const STATUS = ['ATIVO', 'ADIADO', 'CANCELADO'];

router.patch('/:id/status', exigirLogin, async (req, res, next) => {
  try {
    const id = lerId(req, res);
    if (id === null) return;

    const status = req.body?.status;
    if (!STATUS.includes(status)) {
      return responderInvalido(res, { status: `Escolha um status: ${STATUS.join(', ')}.` });
    }
    const aviso = typeof req.body?.aviso === 'string' ? req.body.aviso.trim() : '';
    if (status !== 'ATIVO' && (aviso.length < 5 || aviso.length > 300)) {
      return responderInvalido(res, {
        aviso: 'Escreva um aviso para os participantes (de 5 a 300 caracteres), por exemplo o motivo e a nova data.',
      });
    }

    const atual = await query(
      `SELECT tipo, status, organizador_id, (tipo <> 'AULA' AND data_inicio <= NOW()) AS realizada
       FROM atividade WHERE id = $1`,
      [id],
    );
    const a = atual.rows[0];
    if (!a) return res.status(404).json({ erro: 'Atividade não encontrada.' });
    if (a.organizador_id !== req.organizador.id) {
      return res.status(403).json({ erro: 'Só o organizador que cadastrou a atividade pode alterar o status.' });
    }
    if (a.status === 'CANCELADO') {
      return res.status(409).json({ erro: 'O cancelamento é definitivo: a atividade não pode ser reativada.' });
    }
    if (a.realizada) {
      return res.status(409).json({ erro: 'A atividade já aconteceu; o status não pode mais ser alterado.' });
    }
    if (status === 'ATIVO' && a.status === 'ATIVO') {
      return res.status(409).json({ erro: 'A atividade já está ativa.' });
    }

    const resultado = await query(
      SQL_COM_PRAIA(`
        UPDATE atividade
        SET status = $1, aviso_status = $2, status_alterado_em = NOW()
        WHERE id = $3 AND organizador_id = $4 AND status <> 'CANCELADO'
        RETURNING *
      `),
      [status, status === 'ATIVO' ? null : aviso, id, req.organizador.id],
    );
    if (resultado.rowCount === 0) {
      return res.status(409).json({ erro: 'O cancelamento é definitivo: a atividade não pode ser reativada.' });
    }
    const atividade = formatarDoDono(resultado.rows[0]);

    // Avisa por e-mail quem se inscreveu (só quando a notícia muda: adiamento/cancelamento ou novo aviso).
    let avisados = 0;
    if (status !== 'ATIVO') {
      const inscritos = await query('SELECT nome, contato FROM inscricao WHERE atividade_id = $1', [id]);
      const comEmail = inscritos.rows.filter((i) => i.contato.includes('@'));
      avisados = comEmail.length;
      notificarInscritos(atividade, status, aviso, comEmail).catch((erro) =>
        console.error('Falha ao avisar inscritos:', erro),
      );
    }

    res.json({ atividade, avisados });
  } catch (erro) {
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
