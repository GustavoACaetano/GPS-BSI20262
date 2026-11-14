import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, mockarBanco, linhas, sessaoDe, AUTH } from './helpers.js';
import { limparLimites } from '../src/limitador.js';
import { normalizarContato, validarInscricao } from '../src/validacaoInscricao.js';

// PBI-10: Demonstrar Interesse ou Inscrever-se.

let api;
before(async () => {
  api = await iniciarServidor();
});
after(() => api.fechar());
afterEach(() => {
  mock.restoreAll();
  limparLimites();
});

const corpo = (extras = {}) => ({ nome: 'Bia Souza', contato: '(27) 99999-1234', consentimento: true, ...extras });
const gravada = (extras = {}) => ({
  id: 501, nome: 'Bia Souza', criado_em: new Date('2026-11-14T15:00:00Z'), inscritos: 31, limite_vagas: 32, ...extras,
});

// --- validação ---------------------------------------------------------------

test('normalizarContato aceita e-mail ou telefone brasileiro com DDD', () => {
  assert.equal(normalizarContato(' Bia@Exemplo.com '), 'bia@exemplo.com');
  assert.equal(normalizarContato('(27) 99999-1234'), '27999991234');
  assert.equal(normalizarContato('+55 27 99999-1234'), '27999991234');
  assert.equal(normalizarContato('27 3333-4444'), '2733334444');
  assert.equal(normalizarContato('99999-1234'), null); // sem DDD
  assert.equal(normalizarContato('bia@'), null);
  assert.equal(normalizarContato('me chama no insta'), null);
});

test('validarInscricao exige nome, contato válido e consentimento', () => {
  assert.deepEqual(Object.keys(validarInscricao({}).campos).sort(), ['consentimento', 'contato', 'nome']);
  assert.match(validarInscricao(corpo({ contato: '1234' })).campos.contato, /e-mail válido ou um WhatsApp/);
  assert.ok(validarInscricao(corpo({ consentimento: 'sim' })).campos.consentimento);
  assert.deepEqual(validarInscricao(corpo()).dados, {
    nome: 'Bia Souza', contato: '(27) 99999-1234', contatoNormalizado: '27999991234',
  });
});

// --- POST /api/atividades/:id/inscricoes ------------------------------------

test('inscreve, ocupa a vaga no mesmo comando e devolve o contador atualizado', async () => {
  const consulta = mockarBanco(linhas([gravada()]));

  const { status, corpo: resposta } = await api.post('/api/atividades/7/inscricoes', corpo());

  assert.equal(status, 201);
  assert.deepEqual(resposta, {
    inscricao: { id: 501, nome: 'Bia Souza', criadoEm: '2026-11-14T15:00:00.000Z' },
    interessados: 31,
    vagasRestantes: 1,
  });
  assert.equal(consulta.mock.callCount(), 1);
  const [sql, parametros] = consulta.mock.calls[0].arguments;
  assert.match(sql, /UPDATE atividade SET inscritos = inscritos \+ 1/);
  assert.match(sql, /limite_vagas IS NULL OR inscritos < limite_vagas/);
  assert.match(sql, /status <> 'CANCELADO'/);
  assert.match(sql, /INSERT INTO inscricao/);
  assert.deepEqual(parametros, [7, 'Bia Souza', '(27) 99999-1234', '27999991234']);
});

test('atividade sem limite devolve vagasRestantes nulo', async () => {
  mockarBanco(linhas([gravada({ limite_vagas: null, inscritos: 12 })]));

  const { corpo: resposta } = await api.post('/api/atividades/7/inscricoes', corpo());

  assert.equal(resposta.vagasRestantes, null);
  assert.equal(resposta.interessados, 12);
});

test('valida os campos sem tocar no banco', async () => {
  const consulta = mockarBanco();

  const { status, corpo: resposta } = await api.post('/api/atividades/7/inscricoes', corpo({ nome: '', consentimento: false }));

  assert.equal(status, 400);
  assert.ok(resposta.campos.nome);
  assert.ok(resposta.campos.consentimento);
  assert.equal(consulta.mock.callCount(), 0);
});

test('contato repetido na mesma atividade é recusado', async () => {
  mockarBanco(Object.assign(new Error('dup'), { code: '23505', constraint: 'inscricao_unica' }));

  const { status, corpo: resposta } = await api.post('/api/atividades/7/inscricoes', corpo());

  assert.equal(status, 409);
  assert.equal(resposta.motivo, 'DUPLICADA');
  assert.ok(resposta.campos.contato);
});

for (const [situacao, linha, statusEsperado, motivo] of [
  ['esgotada', { publicada: true, status: 'ATIVO', tipo: 'EVENTO', encerrada: false, limite_vagas: 32, inscritos: 32 }, 409, 'ESGOTADA'],
  ['cancelada', { publicada: true, status: 'CANCELADO', tipo: 'EVENTO', encerrada: false }, 409, 'CANCELADA'],
  ['já realizada', { publicada: true, status: 'ATIVO', tipo: 'ACAO_COMUNITARIA', encerrada: true }, 409, 'ENCERRADA'],
  ['não publicada', { publicada: false, status: 'ATIVO', tipo: 'AULA', encerrada: null }, 404, undefined],
]) {
  test(`explica a recusa quando a atividade está ${situacao}`, async () => {
    mockarBanco(linhas([]), linhas([linha]));

    const { status, corpo: resposta } = await api.post('/api/atividades/7/inscricoes', corpo());

    assert.equal(status, statusEsperado);
    assert.equal(resposta.motivo, motivo);
  });
}

test('atividade inexistente responde 404', async () => {
  mockarBanco(linhas([]), linhas([]));

  const { status } = await api.post('/api/atividades/999/inscricoes', corpo());

  assert.equal(status, 404);
});

test('limita inscrições em sequência vindas do mesmo IP', async () => {
  mockarBanco();
  let ultima;
  for (let i = 0; i < 21; i += 1) {
    ultima = await api.post('/api/atividades/7/inscricoes', { nome: '' });
  }

  assert.equal(ultima.status, 429);
});

// --- Inscritos para o organizador ---------------------------------------------

const ORGANIZADOR = { id: 3, nome: 'Liga', email: 'liga@exemplo.com', telefone: null };

test('organizador dono vê os inscritos com contato', async () => {
  const consulta = mockarBanco(
    sessaoDe(ORGANIZADOR),
    linhas([{ id: 7, tipo: 'EVENTO', titulo: 'Open', limite_vagas: 32, inscritos: 1 }]),
    linhas([{ id: 501, nome: 'Bia', contato: '(27) 99999-1234', criado_em: new Date('2026-11-14T15:00:00Z') }]),
  );

  const { status, corpo: resposta } = await api.get('/api/atividades/minhas/7/inscricoes', AUTH);

  assert.equal(status, 200);
  assert.deepEqual(resposta.atividade, { id: 7, tipo: 'EVENTO', titulo: 'Open', limiteVagas: 32, inscritos: 1 });
  assert.deepEqual(resposta.dados, [
    { id: 501, nome: 'Bia', contato: '(27) 99999-1234', criadoEm: '2026-11-14T15:00:00.000Z' },
  ]);
  assert.deepEqual(consulta.mock.calls[1].arguments[1], [7, 3]);
});

test('inscritos de atividade de outro organizador não são revelados', async () => {
  mockarBanco(sessaoDe(ORGANIZADOR), linhas([]));

  const { status } = await api.get('/api/atividades/minhas/7/inscricoes', AUTH);

  assert.equal(status, 404);
});

test('lista de inscritos exige login', async () => {
  mockarBanco();

  const { status } = await api.get('/api/atividades/minhas/7/inscricoes');

  assert.equal(status, 401);
});

// --- Métricas e edição de vagas -------------------------------------------------

test('GET /api/metricas mostra o progresso das metas do MVP', async () => {
  mockarBanco(linhas([{ inscricoes: 87, atividades: 21 }]));

  const { corpo: resposta } = await api.get('/api/metricas');

  assert.deepEqual(resposta, { inscricoes: 87, atividades: 21, metas: { inscricoes: 100, atividades: 30 } });
});

test('editar o evento para menos vagas que inscritos devolve erro no campo', async () => {
  const ano = new Date().getFullYear() + 1;
  mockarBanco(
    sessaoDe(ORGANIZADOR),
    linhas([{ tipo: 'EVENTO', organizador_id: 3 }]),
    Object.assign(new Error('check'), { code: '23514', constraint: 'inscritos_dentro_do_limite' }),
  );

  const { status, corpo: resposta } = await api.put(
    '/api/atividades/eventos/7',
    {
      titulo: 'Open', modalidade: 'Vôlei', regulamento: 'R', praiaId: 1, localDetalhe: 'Q', responsavel: 'Liga',
      contato: 'x', data: `${ano}-01-10`, hora: '09:00', gratuito: true, limiteVagas: 5,
    },
    AUTH,
  );

  assert.equal(status, 400);
  assert.match(resposta.campos.limiteVagas, /mais inscritos/);
});
