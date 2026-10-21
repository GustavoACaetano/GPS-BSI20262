import { Router } from 'express';
import { query } from '../db.js';
import { formatarBoletim } from '../balneabilidade.js';

const router = Router();

const MUNICIPIOS = ['Vitória', 'Vila Velha', 'Serra', 'Guarapari'];

// Último boletim válido de cada praia (com data de coleta e fonte).
const SQL_PRAIA_COM_BOLETIM = `
  SELECT p.*, b.id AS b_id, b.status AS b_status, b.data_coleta AS b_data_coleta,
         b.data_boletim AS b_data_boletim, b.fonte AS b_fonte
  FROM praia p
  LEFT JOIN LATERAL (
    SELECT * FROM boletim_balneabilidade
    WHERE praia_id = p.id AND data_coleta IS NOT NULL AND fonte IS NOT NULL
    ORDER BY data_boletim DESC
    LIMIT 1
  ) b ON TRUE
`;

function formatarPraia(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    municipio: linha.municipio,
    descricao: linha.descricao,
    latitude: linha.latitude,
    longitude: linha.longitude,
    fotoUrl: linha.foto_url,
    balneabilidade: formatarBoletim(
      linha.b_id && {
        id: linha.b_id,
        status: linha.b_status,
        data_coleta: linha.b_data_coleta,
        data_boletim: linha.b_data_boletim,
        fonte: linha.b_fonte,
      },
    ),
  };
}

function lerId(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ erro: 'Identificador de praia inválido.' });
    return null;
  }
  return id;
}

// PBI-01: GET /api/praias?busca=&municipio=&pagina=&limite=
router.get('/', async (req, res, next) => {
  try {
    const pagina = Math.max(Number.parseInt(req.query.pagina, 10) || 1, 1);
    const limite = Math.min(Math.max(Number.parseInt(req.query.limite, 10) || 50, 1), 100);
    const filtros = [];
    const parametros = [];

    if (req.query.busca) {
      parametros.push(`%${req.query.busca.trim()}%`);
      filtros.push(`(p.nome ILIKE $${parametros.length} OR p.municipio ILIKE $${parametros.length})`);
    }
    if (req.query.municipio) {
      if (!MUNICIPIOS.includes(req.query.municipio)) {
        return res.status(400).json({ erro: `Município deve ser um de: ${MUNICIPIOS.join(', ')}.` });
      }
      parametros.push(req.query.municipio);
      filtros.push(`p.municipio = $${parametros.length}`);
    }

    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const total = await query(`SELECT COUNT(*)::int AS total FROM praia p ${where}`, parametros);

    parametros.push(limite, (pagina - 1) * limite);
    const resultado = await query(
      `${SQL_PRAIA_COM_BOLETIM} ${where}
       ORDER BY p.municipio, p.nome
       LIMIT $${parametros.length - 1} OFFSET $${parametros.length}`,
      parametros,
    );

    res.json({
      dados: resultado.rows.map(formatarPraia),
      total: total.rows[0].total,
      pagina,
      limite,
    });
  } catch (erro) {
    next(erro);
  }
});

// PBI-01: GET /api/praias/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = lerId(req, res);
    if (id === null) return;

    const resultado = await query(`${SQL_PRAIA_COM_BOLETIM} WHERE p.id = $1`, [id]);
    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Praia não encontrada.' });
    }
    res.json(formatarPraia(resultado.rows[0]));
  } catch (erro) {
    next(erro);
  }
});

// PBI-02: GET /api/praias/:id/balneabilidade
router.get('/:id/balneabilidade', async (req, res, next) => {
  try {
    const id = lerId(req, res);
    if (id === null) return;

    const praia = await query('SELECT id FROM praia WHERE id = $1', [id]);
    if (praia.rowCount === 0) {
      return res.status(404).json({ erro: 'Praia não encontrada.' });
    }

    const resultado = await query(
      `SELECT * FROM boletim_balneabilidade
       WHERE praia_id = $1 AND data_coleta IS NOT NULL AND fonte IS NOT NULL
       ORDER BY data_boletim DESC
       LIMIT 10`,
      [id],
    );
    const historico = resultado.rows.map((linha) => formatarBoletim(linha)).filter(Boolean);

    res.json({ atual: historico[0] || null, historico });
  } catch (erro) {
    next(erro);
  }
});

export default router;
