import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarAcao } from '../src/validacaoAcao.js';

// "Agora" fixo: 14/11/2026 12:00 em Brasília.
const AGORA = new Date('2026-11-14T15:00:00Z');

const acaoValida = (extras = {}) => ({
  titulo: ' Mutirão de Camburi ',
  objetivoAmbiental: 'Retirar resíduos da faixa de areia.',
  apoioLocal: 'Prefeitura de Vitória',
  praiaId: 1,
  pontoEncontro: 'Píer de Iemanjá',
  responsavel: 'Instituto Orla Limpa',
  contato: 'voluntarios@orlalimpa.org',
  data: '2026-11-21',
  hora: '08:00',
  recomendacoes: [' Levar luvas ', '', 'Usar protetor solar', 'Levar luvas'],
  ...extras,
});

test('validarAcao normaliza uma ação válida no horário de Brasília', () => {
  const { dados, campos } = validarAcao(acaoValida(), AGORA);

  assert.equal(campos, undefined);
  assert.equal(dados.titulo, 'Mutirão de Camburi');
  assert.equal(dados.dataInicio.toISOString(), '2026-11-21T11:00:00.000Z');
  assert.deepEqual(dados.recomendacoes, ['Levar luvas', 'Usar protetor solar']);
  assert.equal(dados.apoioLocal, 'Prefeitura de Vitória');
});

test('validarAcao aceita ação sem apoio local, descrição e recomendações', () => {
  const { dados } = validarAcao(acaoValida({ apoioLocal: '', recomendacoes: undefined }), AGORA);

  assert.equal(dados.apoioLocal, null);
  assert.equal(dados.descricao, null);
  assert.deepEqual(dados.recomendacoes, []);
});

test('validarAcao aponta todos os campos obrigatórios ausentes', () => {
  const { campos } = validarAcao({}, AGORA);

  assert.deepEqual(Object.keys(campos).sort(), [
    'contato', 'data', 'hora', 'objetivoAmbiental', 'pontoEncontro', 'praiaId', 'responsavel', 'titulo',
  ]);
  assert.equal(campos.objetivoAmbiental, 'Objetivo ecológico é obrigatório.');
});

test('validarAcao exige data futura', () => {
  const { campos } = validarAcao(acaoValida({ data: '2026-11-14', hora: '11:59' }), AGORA);

  assert.equal(campos.data, 'A ação deve acontecer em uma data futura.');
});

test('validarAcao limita a antecedência a 2 anos', () => {
  const { campos } = validarAcao(acaoValida({ data: '2029-01-01' }), AGORA);

  assert.match(campos.data, /2 anos/);
});

test('validarAcao rejeita datas inexistentes e horários inválidos', () => {
  for (const data of ['2027-02-30', '2027-13-01', '21/11/2026']) {
    assert.equal(validarAcao(acaoValida({ data }), AGORA).campos.data, 'Informe a data da ação.');
  }
  assert.ok(validarAcao(acaoValida({ hora: '8h' }), AGORA).campos.hora);
});

test('validarAcao limita quantidade e tamanho das recomendações', () => {
  const muitas = Array.from({ length: 11 }, (_, i) => `Item ${i}`);
  assert.match(validarAcao(acaoValida({ recomendacoes: muitas }), AGORA).campos.recomendacoes, /no máximo 10/);
  assert.match(
    validarAcao(acaoValida({ recomendacoes: ['x'.repeat(121)] }), AGORA).campos.recomendacoes,
    /120 caracteres/,
  );
  assert.match(validarAcao(acaoValida({ recomendacoes: 'luvas' }), AGORA).campos.recomendacoes, /lista/);
});
