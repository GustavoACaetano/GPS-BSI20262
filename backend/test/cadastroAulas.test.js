import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { iniciarServidor, mockarBanco, linhas } from './helpers.js';

// PBI-06: cadastro, edição e publicação de aulas.

let api;
before(async () => {
  api = await iniciarServidor();
});
after(() => api.fechar());
afterEach(() => {
  mock.restoreAll();
  delete process.env.MODERAR_CADASTROS;
  delete process.env.ADMIN_TOKEN;
});

const corpoAula = (extras = {}) => ({
  titulo: 'Surf para iniciantes',
  modalidade: 'Surf',
  instrutor: 'Ana Lima',
  contato: '(27) 99999-0000',
  praiaId: 3,
  diasSemana: ['Sáb', 'Dom'],
  horaInicio: '07:00',
  horaFim: '08:30',
  localDetalhe: 'Píer de Iemanjá',
  ...extras,
});

const linhaGravada = (extras = {}) => ({
  id: 20,
  tipo: 'AULA',
  titulo: 'Surf para iniciantes',
  descricao: null,
  status: 'ATIVO',
  responsavel: 'Ana Lima',
  contato: '(27) 99999-0000',
  praia_id: 3,
  praia_nome: 'Camburi',
  praia_municipio: 'Vitória',
  local_detalhe: 'Píer de Iemanjá',
  interessados: 0,
  modalidade: 'Surf',
  dias_semana: 'Sáb, Dom',
  hora_inicio: '07:00:00',
  hora_fim: '08:30:00',
  token_edicao_hash: 'nao-deve-vazar',
  ...extras,
});

const erroFk = () => Object.assign(new Error('fk'), { code: '23503' });
const hash = (texto) => createHash('sha256').update(texto).digest('hex');

// --- POST /api/atividades/aulas ---------------------------------------------

test('POST /api/atividades/aulas publica imediatamente e devolve o código de edição', async () => {
  const consulta = mockarBanco(linhas([linhaGravada()]));

  const { status, corpo } = await api.post('/api/atividades/aulas', corpoAula());

  assert.equal(status, 201);
  assert.equal(corpo.publicada, true);
  assert.match(corpo.codigoEdicao, /^[0-9a-f]{32}$/);
  assert.equal(corpo.aula.id, 20);
  assert.equal(corpo.aula.instrutor, 'Ana Lima');
  assert.equal(corpo.aula.horaInicio, '07:00');
  assert.equal(JSON.stringify(corpo).includes('nao-deve-vazar'), false);

  const [sql, parametros] = consulta.mock.calls[0].arguments;
  assert.match(sql, /INSERT INTO atividade/);
  assert.deepEqual(parametros.slice(0, 10), [
    'Surf para iniciantes', null, 3, 'Ana Lima', '(27) 99999-0000', 'Surf',
    'Píer de Iemanjá', 'Sáb, Dom', '07:00', '08:30',
  ]);
  assert.equal(parametros[10], true);
  // Só o hash do código vai para o banco.
  assert.equal(parametros[11], hash(corpo.codigoEdicao));
});

test('POST /api/atividades/aulas deixa a aula oculta quando a moderação está ativa', async () => {
  process.env.MODERAR_CADASTROS = 'true';
  const consulta = mockarBanco(linhas([linhaGravada()]));

  const { status, corpo } = await api.post('/api/atividades/aulas', corpoAula());

  assert.equal(status, 201);
  assert.equal(corpo.publicada, false);
  assert.equal(consulta.mock.calls[0].arguments[1][10], false);
});

test('POST /api/atividades/aulas valida os campos obrigatórios sem tocar no banco', async () => {
  const consulta = mockarBanco();

  const { status, corpo } = await api.post('/api/atividades/aulas', corpoAula({ titulo: '', diasSemana: [] }));

  assert.equal(status, 400);
  assert.ok(corpo.campos.titulo);
  assert.ok(corpo.campos.diasSemana);
  assert.equal(consulta.mock.callCount(), 0);
});

test('POST /api/atividades/aulas informa praia inexistente', async () => {
  mockarBanco(erroFk());

  const { status, corpo } = await api.post('/api/atividades/aulas', corpoAula({ praiaId: 999 }));

  assert.equal(status, 400);
  assert.deepEqual(corpo.campos, { praiaId: 'Praia não encontrada.' });
});

test('POST /api/atividades/aulas responde 400 para JSON malformado', async () => {
  mockarBanco();

  const { status } = await api.post('/api/atividades/aulas', '{"titulo":');

  assert.equal(status, 400);
});

// --- PUT /api/atividades/aulas/:id ------------------------------------------

test('PUT /api/atividades/aulas/:id atualiza com o código de edição correto', async () => {
  const consulta = mockarBanco(
    linhas([{ tipo: 'AULA', token_edicao_hash: hash('segredo') }]),
    linhas([linhaGravada({ titulo: 'Surf avançado' })]),
  );

  const { status, corpo } = await api.put(
    '/api/atividades/aulas/20',
    corpoAula({ titulo: 'Surf avançado' }),
    { 'X-Codigo-Edicao': 'segredo' },
  );

  assert.equal(status, 200);
  assert.equal(corpo.aula.titulo, 'Surf avançado');
  const [sql, parametros] = consulta.mock.calls[1].arguments;
  assert.match(sql, /UPDATE atividade/);
  assert.equal(parametros[0], 'Surf avançado');
  assert.equal(parametros.at(-1), 20);
});

test('PUT /api/atividades/aulas/:id recusa código errado ou ausente', async () => {
  for (const cabecalhos of [{ 'X-Codigo-Edicao': 'errado' }, {}]) {
    mockarBanco(linhas([{ tipo: 'AULA', token_edicao_hash: hash('segredo') }]));

    const { status } = await api.put('/api/atividades/aulas/20', corpoAula(), cabecalhos);

    assert.equal(status, 403);
    mock.restoreAll();
  }
});

test('PUT /api/atividades/aulas/:id recusa aulas da carga inicial (sem código)', async () => {
  mockarBanco(linhas([{ tipo: 'AULA', token_edicao_hash: null }]));

  const { status } = await api.put('/api/atividades/aulas/1', corpoAula(), { 'X-Codigo-Edicao': 'x' });

  assert.equal(status, 403);
});

test('PUT /api/atividades/aulas/:id responde 404 para atividade que não é aula', async () => {
  mockarBanco(linhas([{ tipo: 'EVENTO', token_edicao_hash: hash('segredo') }]));

  const { status } = await api.put('/api/atividades/aulas/5', corpoAula(), { 'X-Codigo-Edicao': 'segredo' });

  assert.equal(status, 404);
});

test('PUT /api/atividades/aulas/:id valida os campos depois de conferir o código', async () => {
  const consulta = mockarBanco(linhas([{ tipo: 'AULA', token_edicao_hash: hash('segredo') }]));

  const { status, corpo } = await api.put(
    '/api/atividades/aulas/20',
    corpoAula({ horaFim: '06:00' }),
    { 'X-Codigo-Edicao': 'segredo' },
  );

  assert.equal(status, 400);
  assert.ok(corpo.campos.horaFim);
  assert.equal(consulta.mock.callCount(), 1);
});

// --- PATCH /api/atividades/:id/publicacao -----------------------------------

test('PATCH /publicacao aprova a aula com o token de administração', async () => {
  process.env.ADMIN_TOKEN = 'admin123';
  const consulta = mockarBanco(linhas([{ id: 20, publicada: true }]));

  const { status, corpo } = await api.patch(
    '/api/atividades/20/publicacao',
    { publicada: true },
    { 'X-Admin-Token': 'admin123' },
  );

  assert.equal(status, 200);
  assert.deepEqual(corpo, { id: 20, publicada: true });
  assert.deepEqual(consulta.mock.calls[0].arguments[1], [true, 20]);
});

test('PATCH /publicacao exige token configurado e correto', async () => {
  mockarBanco();
  let resposta = await api.patch('/api/atividades/20/publicacao', { publicada: true }, { 'X-Admin-Token': '' });
  assert.equal(resposta.status, 403);
  assert.match(resposta.corpo.erro, /não configurada/);

  process.env.ADMIN_TOKEN = 'admin123';
  resposta = await api.patch('/api/atividades/20/publicacao', { publicada: true }, { 'X-Admin-Token': 'outro' });
  assert.equal(resposta.status, 403);
});

test('PATCH /publicacao valida o corpo', async () => {
  process.env.ADMIN_TOKEN = 'admin123';
  mockarBanco();

  const { status } = await api.patch(
    '/api/atividades/20/publicacao',
    { publicada: 'sim' },
    { 'X-Admin-Token': 'admin123' },
  );

  assert.equal(status, 400);
});

// --- Consultas públicas só mostram aulas publicadas ---------------------------

test('consultas públicas filtram atividades não publicadas', async () => {
  const consulta = mockarBanco(linhas([]), linhas([]));

  await api.get('/api/atividades?tipo=AULA');
  const detalhe = await api.get('/api/atividades/20');

  assert.match(consulta.mock.calls[0].arguments[0], /a\.publicada/);
  assert.match(consulta.mock.calls[1].arguments[0], /a\.publicada/);
  assert.equal(detalhe.status, 404);
});
