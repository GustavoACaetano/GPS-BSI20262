import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, mockarBanco, linhas } from './helpers.js';
import { limparLimites } from '../src/limitador.js';
import { resumirSatisfacao, validarAvaliacao } from '../src/routes/avaliacoes.js';

// PBI-14: Avaliar Utilidade e Enviar Feedback.

let api;
before(async () => {
  api = await iniciarServidor();
});
after(() => api.fechar());
afterEach(() => {
  mock.restoreAll();
  limparLimites();
  delete process.env.ADMIN_TOKEN;
});

// --- regras -------------------------------------------------------------------------

test('validarAvaliacao aceita nota inteira de 1 a 5 e comentário opcional', () => {
  assert.deepEqual(validarAvaliacao({ nota: 5, comentario: '  Muito útil!  ', pagina: '/explorar' }).dados, {
    nota: 5, comentario: 'Muito útil!', pagina: '/explorar',
  });
  assert.deepEqual(validarAvaliacao({ nota: 1, comentario: '   ' }).dados, { nota: 1, comentario: null, pagina: null });
  for (const nota of [0, 6, 3.5, '4', null, undefined]) {
    assert.equal(validarAvaliacao({ nota }).campos.nota, 'Escolha de 1 a 5 estrelas.');
  }
  assert.match(validarAvaliacao({ nota: 4, comentario: 'x'.repeat(1001) }).campos.comentario, /1000/);
});

test('validarAvaliacao ignora página de origem estranha', () => {
  assert.equal(validarAvaliacao({ nota: 4, pagina: 'https://site.com/<script>' }).dados.pagina, null);
  assert.equal(validarAvaliacao({ nota: 4, pagina: 'inscricao' }).dados.pagina, 'inscricao');
});

test('resumirSatisfacao calcula o percentual de notas 4 e 5 e se a meta de 80% foi atingida', () => {
  assert.deepEqual(resumirSatisfacao({ total: 10, positivas: 8, media: '4.2' }), {
    avaliacoes: 10, positivas: 8, media: 4.2, percentualPositivo: 80, meta: 80, metaAtingida: true,
  });
  assert.equal(resumirSatisfacao({ total: 3, positivas: 2, media: 3.67 }).percentualPositivo, 66.7);
  assert.equal(resumirSatisfacao({ total: 3, positivas: 2, media: 3.67 }).metaAtingida, false);
  assert.deepEqual(resumirSatisfacao({ total: 0, positivas: 0, media: null }), {
    avaliacoes: 0, positivas: 0, media: null, percentualPositivo: null, meta: 80, metaAtingida: false,
  });
});

// --- POST /api/avaliacoes ------------------------------------------------------------

test('registra a avaliação anônima', async () => {
  const consulta = mockarBanco(linhas([{ id: 12, criado_em: new Date() }]));

  const { status, corpo } = await api.post('/api/avaliacoes', { nota: 5, comentario: 'Adorei o mapa', pagina: '/praias' });

  assert.equal(status, 201);
  assert.equal(corpo.id, 12);
  assert.match(corpo.mensagem, /Obrigado/);
  const [sql, parametros] = consulta.mock.calls[0].arguments;
  assert.match(sql, /INSERT INTO avaliacao \(nota, comentario, pagina\)/);
  assert.deepEqual(parametros, [5, 'Adorei o mapa', '/praias']);
});

test('nota inválida é recusada sem gravar', async () => {
  const consulta = mockarBanco();

  const { status, corpo } = await api.post('/api/avaliacoes', { nota: 7 });

  assert.equal(status, 400);
  assert.ok(corpo.campos.nota);
  assert.equal(consulta.mock.callCount(), 0);
});

test('limita avaliações repetidas do mesmo IP', async () => {
  mockarBanco();
  let ultima;
  for (let i = 0; i < 6; i += 1) {
    ultima = await api.post('/api/avaliacoes', { nota: 0 });
  }

  assert.equal(ultima.status, 429);
});

// --- GET /api/avaliacoes (equipe) ------------------------------------------------------

test('a equipe vê o resumo, a distribuição por nota e os comentários', async () => {
  process.env.ADMIN_TOKEN = 'admin123';
  mockarBanco(
    linhas([{ total: 5, positivas: 4, media: '4.0' }]),
    linhas([{ nota: 5, quantidade: 2 }, { nota: 4, quantidade: 2 }, { nota: 2, quantidade: 1 }]),
    linhas([{ id: 9, nota: 2, comentario: 'Faltam praias de Guarapari', pagina: '/praias', criado_em: new Date('2026-11-14T15:00:00Z') }]),
  );

  const { status, corpo } = await api.get('/api/avaliacoes', { 'X-Admin-Token': 'admin123' });

  assert.equal(status, 200);
  assert.equal(corpo.resumo.percentualPositivo, 80);
  assert.equal(corpo.resumo.metaAtingida, true);
  assert.deepEqual(corpo.porNota, { 1: 0, 2: 1, 3: 0, 4: 2, 5: 2 });
  assert.deepEqual(corpo.dados[0], {
    id: 9, nota: 2, comentario: 'Faltam praias de Guarapari', pagina: '/praias', criadoEm: '2026-11-14T15:00:00.000Z',
  });
});

test('listagem da equipe exige o token de administração', async () => {
  mockarBanco();
  const semConfig = await api.get('/api/avaliacoes');
  assert.equal(semConfig.status, 403);

  process.env.ADMIN_TOKEN = 'admin123';
  const errado = await api.get('/api/avaliacoes', { 'X-Admin-Token': 'outro' });
  assert.equal(errado.status, 403);
});

test('/api/metricas inclui a satisfação', async () => {
  mockarBanco(linhas([{ inscricoes: 120, atividades: 18 }]), linhas([{ total: 4, positivas: 3, media: '3.75' }]));

  const { corpo } = await api.get('/api/metricas');

  assert.deepEqual(corpo.satisfacao, {
    avaliacoes: 4, positivas: 3, media: 3.8, percentualPositivo: 75, meta: 80, metaAtingida: false,
  });
});
