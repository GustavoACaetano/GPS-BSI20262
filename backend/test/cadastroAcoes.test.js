import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, mockarBanco, linhas, sessaoDe, AUTH } from './helpers.js';

// PBI-08: Cadastrar Ações Comunitárias (com a autenticação do PBI-11).

let api;
before(async () => {
  api = await iniciarServidor();
});
after(() => api.fechar());
afterEach(() => {
  mock.restoreAll();
  delete process.env.MODERAR_CADASTROS;
});

const ONG = { id: 8, nome: 'Instituto Orla Limpa', email: 'ong@exemplo.org', telefone: null };

// Data sempre no futuro, para o teste não "vencer".
const ano = new Date().getFullYear() + 1;

const corpoAcao = (extras = {}) => ({
  titulo: 'Mutirão de Camburi',
  objetivoAmbiental: 'Retirar resíduos da faixa de areia.',
  apoioLocal: 'Prefeitura de Vitória',
  praiaId: 1,
  pontoEncontro: 'Píer de Iemanjá',
  responsavel: 'Instituto Orla Limpa',
  contato: 'voluntarios@orlalimpa.org',
  data: `${ano}-03-21`,
  hora: '08:00',
  recomendacoes: ['Levar luvas'],
  ...extras,
});

const linhaGravada = (extras = {}) => ({
  id: 40,
  tipo: 'ACAO_COMUNITARIA',
  titulo: 'Mutirão de Camburi',
  descricao: null,
  status: 'ATIVO',
  responsavel: 'Instituto Orla Limpa',
  contato: 'voluntarios@orlalimpa.org',
  praia_id: 1,
  praia_nome: 'Camburi',
  praia_municipio: 'Vitória',
  local_detalhe: 'Píer de Iemanjá',
  interessados: 0,
  data_inicio: new Date(`${ano}-03-21T11:00:00Z`),
  objetivo_ambiental: 'Retirar resíduos da faixa de areia.',
  apoio_local: 'Prefeitura de Vitória',
  recomendacoes: ['Levar luvas'],
  publicada: true,
  organizador_id: 8,
  ...extras,
});

test('POST /api/atividades/acoes exige login', async () => {
  const consulta = mockarBanco();

  const { status } = await api.post('/api/atividades/acoes', corpoAcao());

  assert.equal(status, 401);
  assert.equal(consulta.mock.callCount(), 0);
});

test('POST /api/atividades/acoes publica a ação vinculada ao organizador responsável', async () => {
  const consulta = mockarBanco(sessaoDe(ONG), linhas([linhaGravada()]));

  const { status, corpo } = await api.post('/api/atividades/acoes', corpoAcao(), AUTH);

  assert.equal(status, 201);
  assert.equal(corpo.tipo, 'ACAO_COMUNITARIA');
  assert.equal(corpo.publicada, true);
  assert.equal(corpo.organizadorId, 8);
  assert.equal(corpo.apoioLocal, 'Prefeitura de Vitória');
  assert.equal(corpo.objetivoAmbiental, 'Retirar resíduos da faixa de areia.');
  assert.equal(corpo.pontoEncontro, 'Píer de Iemanjá');

  const [sql, parametros] = consulta.mock.calls[1].arguments;
  assert.match(sql, /INSERT INTO atividade \(tipo, titulo, .*apoio_local, recomendacoes, publicada, organizador_id\)/s);
  assert.match(sql, /VALUES \('ACAO_COMUNITARIA', \$1, .* \$12\)/s);
  assert.deepEqual(parametros.slice(0, 6), [
    'Mutirão de Camburi', null, 1, 'Instituto Orla Limpa', 'voluntarios@orlalimpa.org', 'Píer de Iemanjá',
  ]);
  assert.equal(parametros[6].toISOString(), `${ano}-03-21T11:00:00.000Z`);
  assert.deepEqual(parametros.slice(7), [
    'Retirar resíduos da faixa de areia.', 'Prefeitura de Vitória', ['Levar luvas'], true, 8,
  ]);
});

test('POST /api/atividades/acoes respeita a moderação', async () => {
  process.env.MODERAR_CADASTROS = 'true';
  const consulta = mockarBanco(sessaoDe(ONG), linhas([linhaGravada({ publicada: false })]));

  const { corpo } = await api.post('/api/atividades/acoes', corpoAcao(), AUTH);

  assert.equal(corpo.publicada, false);
  assert.equal(consulta.mock.calls[1].arguments[1][10], false);
});

test('POST /api/atividades/acoes valida o objetivo ecológico e a data', async () => {
  const consulta = mockarBanco(sessaoDe(ONG));

  const { status, corpo } = await api.post(
    '/api/atividades/acoes',
    corpoAcao({ objetivoAmbiental: ' ', data: '2020-01-01' }),
    AUTH,
  );

  assert.equal(status, 400);
  assert.equal(corpo.campos.objetivoAmbiental, 'Objetivo ecológico é obrigatório.');
  assert.equal(corpo.campos.data, 'A ação deve acontecer em uma data futura.');
  assert.equal(consulta.mock.callCount(), 1);
});

test('POST /api/atividades/acoes informa praia inexistente', async () => {
  mockarBanco(sessaoDe(ONG), Object.assign(new Error('fk'), { code: '23503' }));

  const { status, corpo } = await api.post('/api/atividades/acoes', corpoAcao({ praiaId: 999 }), AUTH);

  assert.equal(status, 400);
  assert.deepEqual(corpo.campos, { praiaId: 'Praia não encontrada.' });
});

test('PUT /api/atividades/acoes/:id atualiza a ação do próprio organizador', async () => {
  const consulta = mockarBanco(
    sessaoDe(ONG),
    linhas([{ tipo: 'ACAO_COMUNITARIA', organizador_id: 8 }]),
    linhas([linhaGravada({ apoio_local: null })]),
  );

  const { status, corpo } = await api.put('/api/atividades/acoes/40', corpoAcao({ apoioLocal: '' }), AUTH);

  assert.equal(status, 200);
  assert.equal(corpo.apoioLocal, null);
  const [sql, parametros] = consulta.mock.calls[2].arguments;
  assert.match(sql, /WHERE id = \$11 AND organizador_id = \$12/);
  assert.equal(parametros[8], null);
  assert.deepEqual(parametros.slice(-2), [40, 8]);
});

test('PUT /api/atividades/acoes/:id recusa ação de outro organizador', async () => {
  mockarBanco(sessaoDe(ONG), linhas([{ tipo: 'ACAO_COMUNITARIA', organizador_id: 1 }]));

  const { status, corpo } = await api.put('/api/atividades/acoes/40', corpoAcao(), AUTH);

  assert.equal(status, 403);
  assert.equal(corpo.erro, 'Só o organizador que cadastrou a ação pode editá-la.');
});

test('PUT /api/atividades/acoes/:id não edita aulas por esta rota', async () => {
  mockarBanco(sessaoDe(ONG), linhas([{ tipo: 'AULA', organizador_id: 8 }]));

  const { status, corpo } = await api.put('/api/atividades/acoes/3', corpoAcao(), AUTH);

  assert.equal(status, 404);
  assert.equal(corpo.erro, 'Ação comunitária não encontrada.');
});

test('PUT /api/atividades/aulas/:id não edita ações por esta rota', async () => {
  mockarBanco(sessaoDe(ONG), linhas([{ tipo: 'ACAO_COMUNITARIA', organizador_id: 8 }]));

  const { status } = await api.put('/api/atividades/aulas/40', {}, AUTH);

  assert.equal(status, 404);
});

test('consultas públicas expõem o apoio local da ação', async () => {
  mockarBanco(linhas([linhaGravada()]));

  const { corpo } = await api.get('/api/atividades?tipo=ACAO_COMUNITARIA');

  assert.equal(corpo.dados[0].apoioLocal, 'Prefeitura de Vitória');
});
