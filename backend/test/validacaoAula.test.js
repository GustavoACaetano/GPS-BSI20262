import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarAula } from '../src/validacaoAula.js';

const aulaValida = (extras = {}) => ({
  titulo: '  Surf para iniciantes ',
  modalidade: 'Surf',
  instrutor: 'Ana Lima',
  contato: '(27) 99999-0000',
  praiaId: 3,
  diasSemana: ['Sáb', 'Ter', 'Sáb'],
  horaInicio: '07:00',
  horaFim: '08:30',
  ...extras,
});

test('validarAula normaliza os dados de uma aula válida', () => {
  const { dados, campos } = validarAula(aulaValida({ localDetalhe: '   ' }));

  assert.equal(campos, undefined);
  assert.equal(dados.titulo, 'Surf para iniciantes');
  assert.equal(dados.diasSemana, 'Ter, Sáb');
  assert.equal(dados.localDetalhe, null);
  assert.equal(dados.descricao, null);
  assert.equal(dados.praiaId, 3);
});

test('validarAula aponta todos os campos obrigatórios ausentes', () => {
  const { dados, campos } = validarAula({});

  assert.equal(dados, undefined);
  assert.deepEqual(Object.keys(campos).sort(), [
    'contato', 'diasSemana', 'horaFim', 'horaInicio', 'instrutor', 'modalidade', 'praiaId', 'titulo',
  ]);
});

test('validarAula rejeita término antes do início', () => {
  const { campos } = validarAula(aulaValida({ horaInicio: '09:00', horaFim: '08:00' }));

  assert.deepEqual(campos, { horaFim: 'O término deve ser depois do início.' });
});

test('validarAula rejeita horário fora do formato HH:MM', () => {
  const { campos } = validarAula(aulaValida({ horaInicio: '25:00' }));

  assert.ok(campos.horaInicio);
  assert.equal(campos.horaFim, undefined);
});

test('validarAula rejeita dias inexistentes', () => {
  const { campos } = validarAula(aulaValida({ diasSemana: ['Sab', 'Feriado'] }));

  assert.match(campos.diasSemana, /Dias válidos/);
});

test('validarAula rejeita textos longos demais e praia inválida', () => {
  const { campos } = validarAula(aulaValida({ titulo: 'x'.repeat(161), praiaId: 'abc' }));

  assert.match(campos.titulo, /no máximo 160/);
  assert.equal(campos.praiaId, 'Selecione a praia.');
});

test('validarAula não aceita campos que não são texto', () => {
  const { campos } = validarAula(aulaValida({ instrutor: 42 }));

  assert.equal(campos.instrutor, 'Instrutor é obrigatório.');
});
