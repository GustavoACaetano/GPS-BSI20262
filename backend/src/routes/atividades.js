import { Router } from 'express';
import { query } from '../db.js';

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
    const filtros = ['a.tipo = $1'];

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

// GET /api/atividades/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: 'Identificador de atividade inválido.' });
    }

    const resultado = await query(`${SQL_ATIVIDADE} WHERE a.id = $1`, [id]);
    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Atividade não encontrada.' });
    }
    res.json(formatarAtividade(resultado.rows[0]));
  } catch (erro) {
    next(erro);
  }
});

export default router;
