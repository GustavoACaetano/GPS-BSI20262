import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, mockarBanco, linhas } from './helpers.js';
import { condicoesBusca, escaparLike, lerBusca } from '../src/busca.js';
import { montarFiltros } from '../src/filtrosExplorar.js';

// PBI-13: pesquisa textual por palavra-chave.

let api;
before(async () => {
  api = await iniciarServidor();
});
after(() => api.fechar());
afterEach(() => mock.restoreAll());

// --- regras -----------------------------------------------------------------------

test('lerBusca separa as palavras, ignora repetições e espaços extras', () => {
  assert.deepEqual(lerBusca('  Surf   camburi SURF '), { texto: 'Surf camburi SURF', palavras: ['surf', 'camburi'] });
  assert.deepEqual(lerBusca(''), { palavras: [] });
  assert.deepEqual(lerBusca(undefined), { palavras: [] });
});

test('lerBusca limita tamanho e número de palavras', () => {
  assert.match(lerBusca('x'.repeat(101)).erro, /100 caracteres/);
  assert.match(lerBusca('a b c d e f').erro, /5 palavras/);
});

test('escaparLike trata %, _ e \\ como texto literal', () => {
  assert.equal(escaparLike('50%_a\\b'), '50\\%\\_a\\\\b');
});

test('condicoesBusca gera um LIKE parcial sem acentos por palavra', () => {
  const parametros = [];
  const p = (v) => {
    parametros.push(v);
    return `$${parametros.length}`;
  };

  const condicoes = condicoesBusca(['surf', '100%'], p);

  assert.equal(condicoes.length, 2);
  assert.match(condicoes[0], /unaccent\(lower\(concat_ws\(' ', a\.titulo, .*p\.municipio\)\)\) LIKE '%' \|\| unaccent\(lower\(\$1\)\) \|\| '%' ESCAPE/s);
  assert.deepEqual(parametros, ['surf', '100\\%']);
});

test('montarFiltros combina a busca com os demais filtros', () => {
  const { filtros, parametros, busca } = montarFiltros({ busca: 'surf', categorias: 'AULA', municipio: 'Serra' });

  assert.deepEqual(busca.palavras, ['surf']);
  assert.deepEqual(parametros, [['AULA'], 'surf', 'Serra']);
  assert.match(filtros.join(' AND '), /LIKE '%' \|\| unaccent\(lower\(\$2\)\)/);
  assert.match(montarFiltros({ busca: 'x'.repeat(101) }).erro, /100 caracteres/);
});

// --- rota ----------------------------------------------------------------------------

const atividade = {
  id: 1, tipo: 'AULA', titulo: 'Surf Kids', descricao: null, status: 'ATIVO', responsavel: 'Ana', contato: 'x',
  praia_id: 9, praia_nome: 'Jacaraípe', praia_municipio: 'Serra', local_detalhe: 'Pedra', interessados: 0,
  organizador_id: 1, modalidade: 'Surf', dias_semana: 'Sáb', hora_inicio: '09:00:00', hora_fim: '10:00:00',
};
const praia = { id: 9, nome: 'Jacaraípe', municipio: 'Serra', b_id: null };

test('com busca, devolve atividades e praias encontradas', async () => {
  const consulta = mockarBanco(linhas([atividade]), linhas([praia]));

  const { status, corpo } = await api.get('/api/atividades/explorar?busca=jacaraipe');

  assert.equal(status, 200);
  assert.equal(corpo.total, 1);
  assert.deepEqual(corpo.praias, [{ id: 9, nome: 'Jacaraípe', municipio: 'Serra', balneabilidade: null }]);
  assert.equal(corpo.sugestoes, undefined);
  const [sqlPraias, parametrosPraias] = consulta.mock.calls[1].arguments;
  assert.match(sqlPraias, /concat_ws\(' ', pr\.nome, pr\.municipio, pr\.descricao\)/);
  assert.deepEqual(parametrosPraias, ['jacaraipe']);
});

test('sem busca não procura praias nem sugestões', async () => {
  const consulta = mockarBanco(linhas([]));

  const { corpo } = await api.get('/api/atividades/explorar');

  assert.equal(corpo.praias, undefined);
  assert.equal(corpo.sugestoes, undefined);
  assert.equal(consulta.mock.callCount(), 1);
});

test('com filtro de categoria, a busca não lista praias', async () => {
  const consulta = mockarBanco(linhas([atividade]));

  const { corpo } = await api.get('/api/atividades/explorar?busca=surf&categorias=AULA');

  assert.deepEqual(corpo.praias, []);
  assert.equal(consulta.mock.callCount(), 1);
});

test('nenhum resultado traz sugestões de termos parecidos', async () => {
  const consulta = mockarBanco(linhas([]), linhas([]), linhas([{ termo: 'Surf', nota: 0.57 }]));

  const { corpo } = await api.get('/api/atividades/explorar?busca=surff');

  assert.equal(corpo.total, 0);
  assert.deepEqual(corpo.sugestoes, { termos: ['Surf'], semFiltros: null });
  const [sql, parametros] = consulta.mock.calls[2].arguments;
  assert.match(sql, /similarity\(unaccent\(lower\(termo\)\), unaccent\(lower\(\$1\)\)\)/);
  assert.match(sql, /nota >= 0\.4/);
  assert.deepEqual(parametros, ['surff']);
});

test('nenhum resultado com outros filtros informa quantos haveria só com a busca', async () => {
  const consulta = mockarBanco(linhas([]), linhas([{ total: 3 }]), linhas([]));

  const { corpo } = await api.get('/api/atividades/explorar?busca=camburi&categorias=AULA&modalidade=Surf');

  assert.deepEqual(corpo.sugestoes, { termos: [], semFiltros: 3 });
  const [sql, parametros] = consulta.mock.calls[1].arguments;
  assert.match(sql, /SELECT COUNT\(\*\)::int AS total/);
  assert.deepEqual(parametros, [['AULA', 'EVENTO', 'ACAO_COMUNITARIA'], 'camburi']);
});

test('busca longa demais responde 400 sem consultar o banco', async () => {
  const consulta = mockarBanco();

  const { status } = await api.get(`/api/atividades/explorar?busca=${'x'.repeat(101)}`);

  assert.equal(status, 400);
  assert.equal(consulta.mock.callCount(), 0);
});
