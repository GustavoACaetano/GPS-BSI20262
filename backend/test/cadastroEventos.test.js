import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, mockarBanco, linhas, sessaoDe, AUTH } from './helpers.js';

// PBI-07: Cadastrar e Publicar Eventos Esportivos (com a autenticação do PBI-11).

let api;
before(async () => {
  api = await iniciarServidor();
});
after(() => api.fechar());
afterEach(() => {
  mock.restoreAll();
  delete process.env.MODERAR_CADASTROS;
});

const LIGA = { id: 3, nome: 'Liga de Vôlei', email: 'liga@exemplo.com', telefone: null };
const ano = new Date().getFullYear() + 1;

const corpoEvento = (extras = {}) => ({
  titulo: 'Open de Vôlei',
  modalidade: 'Vôlei de praia',
  regulamento: 'Duplas livres. Sets de 21 pontos.',
  praiaId: 1,
  localDetalhe: 'Quadras da Praça do Cauê',
  responsavel: 'Liga de Vôlei',
  contato: '(27) 98888-0002',
  data: `${ano}-01-10`,
  hora: '09:00',
  gratuito: false,
  valorInscricao: 50,
  limiteVagas: 32,
  ...extras,
});

const linhaGravada = (extras = {}) => ({
  id: 60,
  tipo: 'EVENTO',
  titulo: 'Open de Vôlei',
  descricao: null,
  status: 'ATIVO',
  responsavel: 'Liga de Vôlei',
  contato: '(27) 98888-0002',
  praia_id: 1,
  praia_nome: 'Camburi',
  praia_municipio: 'Vitória',
  local_detalhe: 'Quadras da Praça do Cauê',
  interessados: 0,
  modalidade: 'Vôlei de praia',
  data_inicio: new Date(`${ano}-01-10T12:00:00Z`),
  gratuito: false,
  valor_inscricao: 50,
  regulamento: 'Duplas livres. Sets de 21 pontos.',
  limite_vagas: 32,
  publicada: true,
  organizador_id: 3,
  ...extras,
});

test('POST /api/atividades/eventos exige login', async () => {
  const consulta = mockarBanco();

  const { status } = await api.post('/api/atividades/eventos', corpoEvento());

  assert.equal(status, 401);
  assert.equal(consulta.mock.callCount(), 0);
});

test('POST /api/atividades/eventos publica o evento com regulamento, contato e vagas', async () => {
  const consulta = mockarBanco(sessaoDe(LIGA), linhas([linhaGravada()]));

  const { status, corpo } = await api.post('/api/atividades/eventos', corpoEvento(), AUTH);

  assert.equal(status, 201);
  assert.equal(corpo.tipo, 'EVENTO');
  assert.equal(corpo.publicada, true);
  assert.equal(corpo.organizadorId, 3);
  assert.equal(corpo.regulamento, 'Duplas livres. Sets de 21 pontos.');
  assert.equal(corpo.limiteVagas, 32);
  assert.equal(corpo.contato, '(27) 98888-0002');
  assert.equal(corpo.valorInscricao, 50);

  const [sql, parametros] = consulta.mock.calls[1].arguments;
  assert.match(sql, /INSERT INTO atividade \(tipo, .*regulamento, limite_vagas, publicada, organizador_id\)/s);
  assert.match(sql, /VALUES \('EVENTO', \$1, .* \$14\)/s);
  assert.deepEqual(parametros.slice(0, 7), [
    'Open de Vôlei', null, 1, 'Liga de Vôlei', '(27) 98888-0002', 'Vôlei de praia', 'Quadras da Praça do Cauê',
  ]);
  assert.equal(parametros[7].toISOString(), `${ano}-01-10T12:00:00.000Z`);
  assert.deepEqual(parametros.slice(8), [false, 50, 'Duplas livres. Sets de 21 pontos.', 32, true, 3]);
});

test('POST /api/atividades/eventos aceita evento gratuito sem limite de vagas', async () => {
  const consulta = mockarBanco(sessaoDe(LIGA), linhas([linhaGravada({ gratuito: true, valor_inscricao: null, limite_vagas: null })]));

  const { status, corpo } = await api.post(
    '/api/atividades/eventos',
    corpoEvento({ gratuito: true, valorInscricao: '', limiteVagas: null }),
    AUTH,
  );

  assert.equal(status, 201);
  assert.equal(corpo.limiteVagas, null);
  assert.deepEqual(consulta.mock.calls[1].arguments[1].slice(8, 12), [true, null, 'Duplas livres. Sets de 21 pontos.', null]);
});

test('POST /api/atividades/eventos respeita a moderação', async () => {
  process.env.MODERAR_CADASTROS = 'true';
  const consulta = mockarBanco(sessaoDe(LIGA), linhas([linhaGravada({ publicada: false })]));

  const { corpo } = await api.post('/api/atividades/eventos', corpoEvento(), AUTH);

  assert.equal(corpo.publicada, false);
  assert.equal(consulta.mock.calls[1].arguments[1][12], false);
});

test('POST /api/atividades/eventos valida regulamento, contato, valor e vagas', async () => {
  const consulta = mockarBanco(sessaoDe(LIGA));

  const { status, corpo } = await api.post(
    '/api/atividades/eventos',
    corpoEvento({ regulamento: '', contato: ' ', valorInscricao: 0, limiteVagas: 0 }),
    AUTH,
  );

  assert.equal(status, 400);
  assert.deepEqual(Object.keys(corpo.campos).sort(), ['contato', 'limiteVagas', 'regulamento', 'valorInscricao']);
  assert.equal(consulta.mock.callCount(), 1);
});

test('PUT /api/atividades/eventos/:id atualiza o evento do próprio organizador', async () => {
  const consulta = mockarBanco(
    sessaoDe(LIGA),
    linhas([{ tipo: 'EVENTO', organizador_id: 3 }]),
    linhas([linhaGravada({ limite_vagas: 48 })]),
  );

  const { status, corpo } = await api.put('/api/atividades/eventos/60', corpoEvento({ limiteVagas: 48 }), AUTH);

  assert.equal(status, 200);
  assert.equal(corpo.limiteVagas, 48);
  const [sql, parametros] = consulta.mock.calls[2].arguments;
  assert.match(sql, /WHERE id = \$13 AND organizador_id = \$14/);
  assert.deepEqual(parametros.slice(-2), [60, 3]);
});

test('PUT /api/atividades/eventos/:id recusa evento de outro organizador', async () => {
  mockarBanco(sessaoDe(LIGA), linhas([{ tipo: 'EVENTO', organizador_id: 9 }]));

  const { status, corpo } = await api.put('/api/atividades/eventos/60', corpoEvento(), AUTH);

  assert.equal(status, 403);
  assert.equal(corpo.erro, 'Só o organizador que cadastrou o evento pode editá-lo.');
});

test('PUT /api/atividades/eventos/:id não edita outros tipos', async () => {
  mockarBanco(sessaoDe(LIGA), linhas([{ tipo: 'AULA', organizador_id: 3 }]));

  const { status, corpo } = await api.put('/api/atividades/eventos/1', corpoEvento(), AUTH);

  assert.equal(status, 404);
  assert.equal(corpo.erro, 'Evento esportivo não encontrado.');
});

test('consultas públicas expõem regulamento e limite de vagas do evento', async () => {
  mockarBanco(linhas([linhaGravada()]));

  const { corpo } = await api.get('/api/atividades?tipo=EVENTO');

  assert.equal(corpo.dados[0].regulamento, 'Duplas livres. Sets de 21 pontos.');
  assert.equal(corpo.dados[0].limiteVagas, 32);
});
