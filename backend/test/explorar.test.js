import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, mockarBanco, linhas } from './helpers.js';

// PBI-09: rotas de busca com filtros combinados.

let api;
before(async () => {
  api = await iniciarServidor();
});
after(() => api.fechar());
afterEach(() => mock.restoreAll());

const base = {
  descricao: null, status: 'ATIVO', responsavel: 'Fulano', contato: 'x', praia_id: 3,
  praia_nome: 'Camburi', praia_municipio: 'Vitória', local_detalhe: 'Píer', interessados: 0, organizador_id: 1,
};
const aula = { ...base, id: 1, tipo: 'AULA', titulo: 'Surf', modalidade: 'Surf', dias_semana: 'Sáb', hora_inicio: '07:00:00', hora_fim: '08:00:00' };
const evento = { ...base, id: 2, tipo: 'EVENTO', titulo: 'Open', modalidade: 'Surf', data_inicio: new Date('2026-12-05T12:00:00Z'), gratuito: true, valor_inscricao: null, regulamento: 'R', limite_vagas: null };

test('GET /api/atividades/explorar devolve resultados e contagem por categoria', async () => {
  const consulta = mockarBanco(linhas([aula, evento]));

  const { status, corpo } = await api.get('/api/atividades/explorar?categorias=AULA,EVENTO&praia=3&modalidade=surf');

  assert.equal(status, 200);
  assert.equal(corpo.total, 2);
  assert.deepEqual(corpo.contagem, { AULA: 1, EVENTO: 1 });
  assert.deepEqual(corpo.dados.map((a) => a.tipo), ['AULA', 'EVENTO']);

  const [sql, parametros] = consulta.mock.calls[0].arguments;
  assert.match(sql, /a\.publicada AND a\.tipo = ANY/);
  assert.match(sql, /ORDER BY a\.tipo, a\.data_inicio NULLS LAST/);
  assert.deepEqual(parametros, [['AULA', 'EVENTO'], 3, 'surf']);
});

test('GET /api/atividades/explorar sem filtros conta as três categorias', async () => {
  mockarBanco(linhas([]));

  const { corpo } = await api.get('/api/atividades/explorar');

  assert.deepEqual(corpo.contagem, { AULA: 0, EVENTO: 0, ACAO_COMUNITARIA: 0 });
});

test('GET /api/atividades/explorar responde 400 para filtro inválido sem consultar o banco', async () => {
  const consulta = mockarBanco();

  const { status, corpo } = await api.get('/api/atividades/explorar?de=2026-11-22&ate=2026-11-20');

  assert.equal(status, 400);
  assert.match(corpo.erro, /posterior/);
  assert.equal(consulta.mock.callCount(), 0);
});

test('GET /api/atividades/modalidades lista as modalidades disponíveis', async () => {
  const consulta = mockarBanco(linhas([{ modalidade: 'Futevôlei' }, { modalidade: 'Surf' }]));

  const { status, corpo } = await api.get('/api/atividades/modalidades');

  assert.equal(status, 200);
  assert.deepEqual(corpo.dados, ['Futevôlei', 'Surf']);
  assert.match(consulta.mock.calls[0].arguments[0], /GROUP BY LOWER\(TRIM\(modalidade\)\)/);
});
