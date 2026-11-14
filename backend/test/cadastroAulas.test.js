import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, mockarBanco, linhas, sessaoDe, AUTH } from './helpers.js';

// PBI-06 (com a autenticação do PBI-11): cadastro, edição e publicação de aulas.

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

const ORGANIZADOR = { id: 5, nome: 'Ana Lima', email: 'ana@exemplo.com', telefone: null };

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
  publicada: true,
  organizador_id: 5,
  ...extras,
});

const erroFk = () => Object.assign(new Error('fk'), { code: '23503' });

// --- POST /api/atividades/aulas ---------------------------------------------

test('POST /api/atividades/aulas exige login', async () => {
  const consulta = mockarBanco();

  const { status } = await api.post('/api/atividades/aulas', corpoAula());

  assert.equal(status, 401);
  assert.equal(consulta.mock.callCount(), 0);
});

test('POST /api/atividades/aulas recusa sessão inválida ou expirada', async () => {
  mockarBanco(linhas([]));

  const { status, corpo } = await api.post('/api/atividades/aulas', corpoAula(), AUTH);

  assert.equal(status, 401);
  assert.match(corpo.erro, /Sessão expirada/);
});

test('POST /api/atividades/aulas publica imediatamente e vincula ao organizador', async () => {
  const consulta = mockarBanco(sessaoDe(ORGANIZADOR), linhas([linhaGravada()]));

  const { status, corpo } = await api.post('/api/atividades/aulas', corpoAula(), AUTH);

  assert.equal(status, 201);
  assert.equal(corpo.id, 20);
  assert.equal(corpo.publicada, true);
  assert.equal(corpo.organizadorId, 5);
  assert.equal(corpo.horaInicio, '07:00');

  const [sql, parametros] = consulta.mock.calls[1].arguments;
  assert.match(sql, /INSERT INTO atividade/);
  assert.deepEqual(parametros, [
    'Surf para iniciantes', null, 3, 'Ana Lima', '(27) 99999-0000', 'Surf',
    'Píer de Iemanjá', 'Sáb, Dom', '07:00', '08:30', true, 5,
  ]);
});

test('POST /api/atividades/aulas deixa a aula oculta quando a moderação está ativa', async () => {
  process.env.MODERAR_CADASTROS = 'true';
  const consulta = mockarBanco(sessaoDe(ORGANIZADOR), linhas([linhaGravada({ publicada: false })]));

  const { status, corpo } = await api.post('/api/atividades/aulas', corpoAula(), AUTH);

  assert.equal(status, 201);
  assert.equal(corpo.publicada, false);
  assert.equal(consulta.mock.calls[1].arguments[1][10], false);
});

test('POST /api/atividades/aulas valida os campos obrigatórios sem gravar', async () => {
  const consulta = mockarBanco(sessaoDe(ORGANIZADOR));

  const { status, corpo } = await api.post(
    '/api/atividades/aulas',
    corpoAula({ titulo: '', diasSemana: [] }),
    AUTH,
  );

  assert.equal(status, 400);
  assert.ok(corpo.campos.titulo);
  assert.ok(corpo.campos.diasSemana);
  assert.equal(consulta.mock.callCount(), 1); // só a verificação da sessão
});

test('POST /api/atividades/aulas informa praia inexistente', async () => {
  mockarBanco(sessaoDe(ORGANIZADOR), erroFk());

  const { status, corpo } = await api.post('/api/atividades/aulas', corpoAula({ praiaId: 999 }), AUTH);

  assert.equal(status, 400);
  assert.deepEqual(corpo.campos, { praiaId: 'Praia não encontrada.' });
});

test('POST /api/atividades/aulas responde 400 para JSON malformado', async () => {
  mockarBanco();

  const { status } = await api.post('/api/atividades/aulas', '{"titulo":', AUTH);

  assert.equal(status, 400);
});

// --- PUT /api/atividades/aulas/:id ------------------------------------------

test('PUT /api/atividades/aulas/:id atualiza a aula do próprio organizador', async () => {
  const consulta = mockarBanco(
    sessaoDe(ORGANIZADOR),
    linhas([{ tipo: 'AULA', organizador_id: 5 }]),
    linhas([linhaGravada({ titulo: 'Surf avançado' })]),
  );

  const { status, corpo } = await api.put(
    '/api/atividades/aulas/20',
    corpoAula({ titulo: 'Surf avançado' }),
    AUTH,
  );

  assert.equal(status, 200);
  assert.equal(corpo.titulo, 'Surf avançado');
  const [sql, parametros] = consulta.mock.calls[2].arguments;
  assert.match(sql, /UPDATE atividade/);
  assert.match(sql, /organizador_id = \$12/);
  assert.equal(parametros[0], 'Surf avançado');
  assert.deepEqual(parametros.slice(-2), [20, 5]);
});

test('PUT /api/atividades/aulas/:id exige login', async () => {
  mockarBanco();

  const { status } = await api.put('/api/atividades/aulas/20', corpoAula());

  assert.equal(status, 401);
});

test('PUT /api/atividades/aulas/:id recusa aula de outro organizador', async () => {
  mockarBanco(sessaoDe(ORGANIZADOR), linhas([{ tipo: 'AULA', organizador_id: 9 }]));

  const { status, corpo } = await api.put('/api/atividades/aulas/20', corpoAula(), AUTH);

  assert.equal(status, 403);
  assert.match(corpo.erro, /Só o organizador/);
});

test('PUT /api/atividades/aulas/:id recusa aula sem dono', async () => {
  mockarBanco(sessaoDe(ORGANIZADOR), linhas([{ tipo: 'AULA', organizador_id: null }]));

  const { status } = await api.put('/api/atividades/aulas/1', corpoAula(), AUTH);

  assert.equal(status, 403);
});

test('PUT /api/atividades/aulas/:id responde 404 para atividade que não é aula', async () => {
  mockarBanco(sessaoDe(ORGANIZADOR), linhas([{ tipo: 'EVENTO', organizador_id: 5 }]));

  const { status } = await api.put('/api/atividades/aulas/5', corpoAula(), AUTH);

  assert.equal(status, 404);
});

test('PUT /api/atividades/aulas/:id valida os campos', async () => {
  const consulta = mockarBanco(sessaoDe(ORGANIZADOR), linhas([{ tipo: 'AULA', organizador_id: 5 }]));

  const { status, corpo } = await api.put('/api/atividades/aulas/20', corpoAula({ horaFim: '06:00' }), AUTH);

  assert.equal(status, 400);
  assert.ok(corpo.campos.horaFim);
  assert.equal(consulta.mock.callCount(), 2);
});

// --- Minhas publicações (PBI-11) ---------------------------------------------

test('GET /api/atividades/minhas lista as publicações do organizador, inclusive pendentes', async () => {
  const consulta = mockarBanco(
    sessaoDe(ORGANIZADOR),
    linhas([linhaGravada(), linhaGravada({ id: 21, publicada: false })]),
  );

  const { status, corpo } = await api.get('/api/atividades/minhas', AUTH);

  assert.equal(status, 200);
  assert.equal(corpo.total, 2);
  assert.deepEqual(corpo.dados.map((a) => a.publicada), [true, false]);
  const [sql, parametros] = consulta.mock.calls[1].arguments;
  assert.match(sql, /a\.organizador_id = \$1/);
  assert.doesNotMatch(sql, /a\.publicada/);
  assert.deepEqual(parametros, [5]);
});

test('GET /api/atividades/minhas exige login', async () => {
  mockarBanco();

  const { status } = await api.get('/api/atividades/minhas');

  assert.equal(status, 401);
});

test('GET /api/atividades/minhas/:id só encontra publicações do próprio organizador', async () => {
  const consulta = mockarBanco(sessaoDe(ORGANIZADOR), linhas([]));

  const { status } = await api.get('/api/atividades/minhas/30', AUTH);

  assert.equal(status, 404);
  assert.deepEqual(consulta.mock.calls[1].arguments[1], [30, 5]);
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
