import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, mockarBanco, linhas } from './helpers.js';

let api;
before(async () => {
  api = await iniciarServidor();
});
after(() => api.fechar());
afterEach(() => mock.restoreAll());

const atividade = (extras = {}) => ({
  id: 1,
  tipo: 'AULA',
  titulo: 'Surf para iniciantes',
  descricao: 'Aula em grupo',
  status: 'ATIVO',
  responsavel: 'Ana',
  contato: '27 99999-0000',
  praia_id: 3,
  praia_nome: 'Camburi',
  praia_municipio: 'Vitória',
  local_detalhe: 'Píer de Iemanjá',
  interessados: 4,
  modalidade: 'Surf',
  dias_semana: ['SAB', 'DOM'],
  hora_inicio: '07:00:00',
  hora_fim: '08:30:00',
  data_inicio: null,
  gratuito: null,
  valor_inscricao: null,
  objetivo_ambiental: null,
  recomendacoes: null,
  ...extras,
});

test('GET /api/atividades exige tipo válido', async () => {
  const consulta = mockarBanco();

  const { status, corpo } = await api.get('/api/atividades?tipo=FESTA');

  assert.equal(status, 400);
  assert.match(corpo.erro, /AULA, EVENTO, ACAO_COMUNITARIA/);
  assert.equal(consulta.mock.callCount(), 0);
});

test('GET /api/atividades rejeita ordenação inválida para o tipo', async () => {
  mockarBanco();

  const { status, corpo } = await api.get('/api/atividades?tipo=EVENTO&ordenar=modalidade');

  assert.equal(status, 400);
  assert.match(corpo.erro, /Use: data/);
});

test('GET /api/atividades rejeita praia inválida', async () => {
  mockarBanco();

  const { status } = await api.get('/api/atividades?tipo=AULA&praia=-1');

  assert.equal(status, 400);
});

test('GET /api/atividades formata aulas com horários HH:MM', async () => {
  const consulta = mockarBanco(linhas([atividade()]));

  const { status, corpo } = await api.get('/api/atividades?tipo=AULA');

  assert.equal(status, 200);
  assert.equal(corpo.total, 1);
  const [aula] = corpo.dados;
  assert.equal(aula.instrutor, 'Ana');
  assert.equal(aula.horaInicio, '07:00');
  assert.equal(aula.horaFim, '08:30');
  assert.deepEqual(aula.praia, { id: 3, nome: 'Camburi', municipio: 'Vitória' });

  const [sql, parametros] = consulta.mock.calls[0].arguments;
  assert.match(sql, /ORDER BY a\.modalidade, a\.titulo$/);
  assert.doesNotMatch(sql, /date_trunc/);
  assert.deepEqual(parametros, ['AULA']);
});

test('GET /api/atividades ordena aulas por praia e filtra pela praia', async () => {
  const consulta = mockarBanco(linhas([]));

  await api.get('/api/atividades?tipo=AULA&ordenar=praia&praia=3');

  const [sql, parametros] = consulta.mock.calls[0].arguments;
  assert.match(sql, /a\.praia_id = \$2/);
  assert.match(sql, /ORDER BY p\.nome, a\.modalidade$/);
  assert.deepEqual(parametros, ['AULA', 3]);
});

test('GET /api/atividades lista apenas próximos eventos com dados de inscrição', async () => {
  const data = new Date('2026-11-05T13:00:00Z');
  const consulta = mockarBanco(
    linhas([atividade({ tipo: 'EVENTO', data_inicio: data, gratuito: false, valor_inscricao: 50 })]),
  );

  const { corpo } = await api.get('/api/atividades?tipo=EVENTO');

  const [evento] = corpo.dados;
  assert.equal(evento.dataInicio, data.toISOString());
  assert.equal(evento.gratuito, false);
  assert.equal(evento.valorInscricao, 50);
  assert.equal(evento.horaInicio, undefined);
  assert.match(consulta.mock.calls[0].arguments[0], /date_trunc\('day', NOW\(\)\)/);
});

test('GET /api/atividades formata ações comunitárias', async () => {
  const data = new Date('2026-11-10T11:00:00Z');
  mockarBanco(
    linhas([
      atividade({
        tipo: 'ACAO_COMUNITARIA',
        data_inicio: data,
        objetivo_ambiental: 'Limpeza da faixa de areia',
        recomendacoes: ['Levar luvas'],
      }),
    ]),
  );

  const { corpo } = await api.get('/api/atividades?tipo=ACAO_COMUNITARIA');

  const [acao] = corpo.dados;
  assert.equal(acao.pontoEncontro, 'Píer de Iemanjá');
  assert.equal(acao.objetivoAmbiental, 'Limpeza da faixa de areia');
  assert.deepEqual(acao.recomendacoes, ['Levar luvas']);
  assert.equal(acao.modalidade, undefined);
});

test('GET /api/atividades/:id retorna a atividade', async () => {
  mockarBanco(linhas([atividade({ id: 8 })]));

  const { status, corpo } = await api.get('/api/atividades/8');

  assert.equal(status, 200);
  assert.equal(corpo.id, 8);
});

test('GET /api/atividades/:id retorna 404 quando não existe', async () => {
  mockarBanco(linhas([]));

  const { status } = await api.get('/api/atividades/8');

  assert.equal(status, 404);
});

test('GET /api/atividades/:id rejeita identificador inválido', async () => {
  mockarBanco();

  const { status } = await api.get('/api/atividades/0');

  assert.equal(status, 400);
});
