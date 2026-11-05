import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, mockarBanco, linhas } from './helpers.js';

let api;
before(async () => {
  api = await iniciarServidor();
});
after(() => api.fechar());
afterEach(() => mock.restoreAll());

const praia = (extras = {}) => ({
  id: 1,
  nome: 'Camburi',
  municipio: 'Vitória',
  descricao: 'Praia urbana',
  latitude: -20.27,
  longitude: -40.28,
  foto_url: null,
  b_id: 10,
  b_status: 'PROPRIA',
  b_data_coleta: '2026-10-19',
  b_data_boletim: new Date(),
  b_fonte: 'IEMA',
  ...extras,
});

test('GET /api/praias lista praias com o boletim formatado', async () => {
  mockarBanco(linhas([{ total: 1 }]), linhas([praia()]));

  const { status, corpo } = await api.get('/api/praias');

  assert.equal(status, 200);
  assert.equal(corpo.total, 1);
  assert.equal(corpo.pagina, 1);
  assert.equal(corpo.limite, 50);
  assert.equal(corpo.dados[0].nome, 'Camburi');
  assert.equal(corpo.dados[0].fotoUrl, null);
  assert.equal(corpo.dados[0].balneabilidade.status, 'PROPRIA');
  assert.equal(corpo.dados[0].balneabilidade.fonte, 'IEMA');
});

test('GET /api/praias retorna balneabilidade null para praia sem boletim', async () => {
  mockarBanco(linhas([{ total: 1 }]), linhas([praia({ b_id: null })]));

  const { corpo } = await api.get('/api/praias');

  assert.equal(corpo.dados[0].balneabilidade, null);
});

test('GET /api/praias aplica busca e município como parâmetros da consulta', async () => {
  const consulta = mockarBanco(linhas([{ total: 0 }]), linhas([]));

  await api.get('/api/praias?busca=%20camb%20&municipio=Serra');

  const [sql, parametros] = consulta.mock.calls[0].arguments;
  assert.match(sql, /ILIKE \$1/);
  assert.match(sql, /p\.municipio = \$2/);
  // O mesmo array é reaproveitado na consulta paginada (recebe limite e offset depois).
  assert.deepEqual(parametros.slice(0, 2), ['%camb%', 'Serra']);
});

test('GET /api/praias limita paginação entre 1 e 100 itens', async () => {
  const consulta = mockarBanco(linhas([{ total: 0 }]), linhas([]));

  const { corpo } = await api.get('/api/praias?pagina=3&limite=500');

  assert.equal(corpo.limite, 100);
  assert.equal(corpo.pagina, 3);
  assert.deepEqual(consulta.mock.calls[1].arguments[1], [100, 200]);
});

test('GET /api/praias rejeita município fora da lista', async () => {
  mockarBanco();

  const { status, corpo } = await api.get('/api/praias?municipio=Rio');

  assert.equal(status, 400);
  assert.match(corpo.erro, /Município deve ser um de/);
});

test('GET /api/praias/:id retorna a praia', async () => {
  mockarBanco(linhas([praia({ id: 7 })]));

  const { status, corpo } = await api.get('/api/praias/7');

  assert.equal(status, 200);
  assert.equal(corpo.id, 7);
});

test('GET /api/praias/:id retorna 404 quando não existe', async () => {
  mockarBanco(linhas([]));

  const { status, corpo } = await api.get('/api/praias/99');

  assert.equal(status, 404);
  assert.equal(corpo.erro, 'Praia não encontrada.');
});

test('GET /api/praias/:id rejeita identificador inválido', async () => {
  const consulta = mockarBanco();

  const { status } = await api.get('/api/praias/abc');

  assert.equal(status, 400);
  assert.equal(consulta.mock.callCount(), 0);
});

test('GET /api/praias/:id/balneabilidade retorna atual e histórico', async () => {
  const boletim = (id, data) => ({
    id,
    status: 'IMPROPRIA',
    data_coleta: '2026-10-01',
    data_boletim: new Date(data),
    fonte: 'IEMA',
  });
  mockarBanco(
    linhas([{ id: 1 }]),
    linhas([boletim(2, '2026-10-10'), boletim(1, '2026-10-01')]),
  );

  const { status, corpo } = await api.get('/api/praias/1/balneabilidade');

  assert.equal(status, 200);
  assert.equal(corpo.atual.id, 2);
  assert.equal(corpo.historico.length, 2);
});

test('GET /api/praias/:id/balneabilidade sem boletins retorna atual null', async () => {
  mockarBanco(linhas([{ id: 1 }]), linhas([]));

  const { corpo } = await api.get('/api/praias/1/balneabilidade');

  assert.deepEqual(corpo, { atual: null, historico: [] });
});

test('GET /api/praias/:id/balneabilidade retorna 404 para praia inexistente', async () => {
  mockarBanco(linhas([]));

  const { status } = await api.get('/api/praias/5/balneabilidade');

  assert.equal(status, 404);
});
