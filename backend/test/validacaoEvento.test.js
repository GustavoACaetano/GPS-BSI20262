import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarEvento } from '../src/validacaoEvento.js';

// "Agora" fixo: 14/11/2026 12:00 em Brasília.
const AGORA = new Date('2026-11-14T15:00:00Z');

const eventoValido = (extras = {}) => ({
  titulo: ' Open de Vôlei ',
  modalidade: 'Vôlei de praia',
  regulamento: 'Duplas livres.\nSets de 21 pontos.',
  praiaId: 1,
  localDetalhe: 'Quadras da Praça do Cauê',
  responsavel: 'Associação Camburi Esportes',
  contato: '(27) 98888-0002',
  data: '2026-12-05',
  hora: '09:00',
  gratuito: false,
  valorInscricao: '45.5',
  limiteVagas: '32',
  ...extras,
});

test('validarEvento normaliza um evento pago com limite de vagas', () => {
  const { dados, campos } = validarEvento(eventoValido(), AGORA);

  assert.equal(campos, undefined);
  assert.equal(dados.titulo, 'Open de Vôlei');
  assert.equal(dados.regulamento, 'Duplas livres.\nSets de 21 pontos.');
  assert.equal(dados.valorInscricao, 45.5);
  assert.equal(dados.limiteVagas, 32);
  assert.equal(dados.dataInicio.toISOString(), '2026-12-05T12:00:00.000Z');
});

test('validarEvento: gratuito ignora valor e vagas em branco significa sem limite', () => {
  const { dados } = validarEvento(eventoValido({ gratuito: true, valorInscricao: '99', limiteVagas: '' }), AGORA);

  assert.equal(dados.gratuito, true);
  assert.equal(dados.valorInscricao, null);
  assert.equal(dados.limiteVagas, null);
});

test('validarEvento aponta os campos obrigatórios, inclusive regulamento e contato', () => {
  const { campos } = validarEvento({}, AGORA);

  assert.deepEqual(Object.keys(campos).sort(), [
    'contato', 'data', 'gratuito', 'hora', 'localDetalhe', 'modalidade', 'praiaId', 'regulamento', 'responsavel', 'titulo',
  ]);
  assert.equal(campos.regulamento, 'Regulamento é obrigatório.');
  assert.equal(campos.data, 'Informe a data do evento.');
});

test('validarEvento exige valor positivo quando o evento é pago', () => {
  for (const valorInscricao of ['', null, '0', '-10', 'abc']) {
    assert.equal(
      validarEvento(eventoValido({ valorInscricao }), AGORA).campos.valorInscricao,
      'Informe o valor da inscrição.',
    );
  }
  assert.match(validarEvento(eventoValido({ valorInscricao: 10000 }), AGORA).campos.valorInscricao, /máximo/);
});

test('validarEvento rejeita limite de vagas inválido', () => {
  for (const limiteVagas of ['0', '-5', '2.5', 'muitas']) {
    assert.match(validarEvento(eventoValido({ limiteVagas }), AGORA).campos.limiteVagas, /inteiro maior que zero/);
  }
  assert.match(validarEvento(eventoValido({ limiteVagas: 100001 }), AGORA).campos.limiteVagas, /no máximo/);
});

test('validarEvento exige data futura', () => {
  const { campos } = validarEvento(eventoValido({ data: '2026-11-14', hora: '11:00' }), AGORA);

  assert.equal(campos.data, 'O evento deve acontecer em uma data futura.');
});

test('validarEvento exige que "gratuito" seja booleano', () => {
  const { campos } = validarEvento(eventoValido({ gratuito: 'sim' }), AGORA);

  assert.equal(campos.gratuito, 'Informe se o evento é gratuito ou pago.');
});
