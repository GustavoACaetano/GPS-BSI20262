import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diasDaSemanaNoPeriodo, montarFiltros } from '../src/filtrosExplorar.js';

// PBI-09: interpretação dos filtros combinados.

test('sem filtros, busca todas as categorias publicadas e próximas', () => {
  const { filtros, parametros, tipos } = montarFiltros({});

  assert.deepEqual(tipos, ['AULA', 'EVENTO', 'ACAO_COMUNITARIA']);
  assert.deepEqual(parametros, [['AULA', 'EVENTO', 'ACAO_COMUNITARIA']]);
  assert.equal(filtros[0], 'a.publicada');
  assert.match(filtros.join(' '), /a\.tipo = ANY\(\$1::tipo_atividade\[\]\)/);
  assert.match(filtros.join(' '), /a\.tipo = 'AULA' OR a\.data_inicio >= date_trunc/);
});

test('combina categoria, praia, município e modalidade', () => {
  const { filtros, parametros, tipos } = montarFiltros({
    categorias: 'EVENTO,AULA,EVENTO',
    praia: '3',
    municipio: 'Vitória',
    modalidade: ' surf ',
  });

  assert.deepEqual(tipos, ['EVENTO', 'AULA']);
  assert.deepEqual(parametros, [['EVENTO', 'AULA'], 3, 'Vitória', 'surf']);
  const sql = filtros.join(' AND ');
  assert.match(sql, /a\.praia_id = \$2/);
  assert.match(sql, /p\.municipio = \$3/);
  assert.match(sql, /LOWER\(TRIM\(a\.modalidade\)\) = LOWER\(\$4\)/);
});

test('rejeita filtros inválidos', () => {
  assert.match(montarFiltros({ categorias: 'AULA,FESTA' }).erro, /Categorias válidas/);
  assert.match(montarFiltros({ praia: 'abc' }).erro, /praia/);
  assert.match(montarFiltros({ municipio: 'Cariacica' }).erro, /Município/);
  assert.match(montarFiltros({ modalidade: 'x'.repeat(61) }).erro, /modalidade/);
});

test('período filtra eventos/ações por data e aulas pelos dias da semana cobertos', () => {
  // 2026-11-20 é sexta-feira; o período cobre sexta, sábado e domingo.
  const { filtros, parametros } = montarFiltros({ de: '2026-11-20', ate: '2026-11-22' });

  assert.deepEqual(parametros.slice(1), [
    '2026-11-20T00:00:00-03:00',
    '2026-11-22T23:59:59.999-03:00',
    ['Sex', 'Sáb', 'Dom'],
  ]);
  const sql = filtros.join(' ');
  assert.match(sql, /string_to_array\(a\.dias_semana, ', '\) && \$4::text\[\]/);
  assert.match(sql, /a\.data_inicio BETWEEN \$2::timestamptz AND \$3::timestamptz/);
});

test('período exige as duas datas válidas e em ordem, com até 1 ano', () => {
  assert.match(montarFiltros({ de: '2026-11-20' }).erro, /AAAA-MM-DD/);
  assert.match(montarFiltros({ de: '2026-02-30', ate: '2026-03-01' }).erro, /AAAA-MM-DD/);
  assert.match(montarFiltros({ de: '2026-13-01', ate: '2026-13-02' }).erro, /AAAA-MM-DD/);
  assert.match(montarFiltros({ de: '2026-11-22', ate: '2026-11-20' }).erro, /posterior/);
  assert.match(montarFiltros({ de: '2026-01-01', ate: '2027-06-01' }).erro, /1 ano/);
});

test('"só praias próprias" usa o último boletim válido e em dia', () => {
  const { filtros, parametros } = montarFiltros({ propria: 'true' });

  const sql = filtros.join(' ');
  assert.match(sql, /ultimo\.status = 'PROPRIA'/);
  assert.match(sql, /data_coleta IS NOT NULL AND b\.fonte IS NOT NULL/);
  assert.equal(parametros.at(-1), 8); // boletim com até 7 dias completos
  assert.equal(montarFiltros({ propria: 'false' }).filtros.some((f) => f.includes('PROPRIA')), false);
});

test('diasDaSemanaNoPeriodo', () => {
  assert.deepEqual(diasDaSemanaNoPeriodo('2026-11-16', '2026-11-16'), ['Seg']);
  assert.deepEqual(diasDaSemanaNoPeriodo('2026-11-21', '2026-11-22'), ['Sáb', 'Dom']);
  assert.deepEqual(diasDaSemanaNoPeriodo('2026-11-01', '2026-11-30'), ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']);
});
