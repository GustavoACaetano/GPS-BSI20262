import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, mockarBanco, linhas } from './helpers.js';

let api;
before(async () => {
  api = await iniciarServidor();
});
after(() => api.fechar());
afterEach(() => mock.restoreAll());

test('GET /api/health retorna ok quando o banco responde', async () => {
  mockarBanco(linhas([{ '?column?': 1 }]));

  const { status, corpo } = await api.get('/api/health');

  assert.equal(status, 200);
  assert.deepEqual(corpo, { status: 'ok', banco: 'ok' });
});

test('GET /api/health retorna 503 quando o banco está indisponível', async () => {
  mockarBanco(new Error('conexão recusada'));

  const { status, corpo } = await api.get('/api/health');

  assert.equal(status, 503);
  assert.equal(corpo.banco, 'indisponível');
});

test('rota inexistente da API retorna 404 em JSON', async () => {
  const { status, corpo } = await api.get('/api/nao-existe');

  assert.equal(status, 404);
  assert.equal(corpo.erro, 'Recurso não encontrado.');
});

test('erro inesperado no banco retorna 500 sem expor detalhes', async () => {
  mockarBanco(new Error('falha interna'));
  mock.method(console, 'error', () => {});

  const { status, corpo } = await api.get('/api/praias/1');

  assert.equal(status, 500);
  assert.deepEqual(corpo, { erro: 'Erro interno do servidor.' });
});
