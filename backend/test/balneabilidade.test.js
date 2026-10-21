import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatarBoletim } from '../src/balneabilidade.js';

const agora = new Date('2026-10-21T12:00:00Z');

const boletim = (diasAtras, extras = {}) => ({
  id: 1,
  status: 'PROPRIA',
  data_coleta: '2026-10-19',
  data_boletim: new Date(agora - diasAtras * 24 * 60 * 60 * 1000),
  fonte: 'IEMA',
  ...extras,
});

test('boletim recente não fica pendente de atualização', () => {
  const resultado = formatarBoletim(boletim(2), agora);
  assert.equal(resultado.pendenteAtualizacao, false);
  assert.equal(resultado.diasDesdeBoletim, 2);
  assert.equal(resultado.fonte, 'IEMA');
});

test('boletim com exatamente 7 dias ainda é considerado atualizado', () => {
  assert.equal(formatarBoletim(boletim(7), agora).pendenteAtualizacao, false);
});

test('boletim com mais de 7 dias fica pendente de atualização', () => {
  assert.equal(formatarBoletim(boletim(8), agora).pendenteAtualizacao, true);
});

test('boletim sem data de coleta não é exibido', () => {
  assert.equal(formatarBoletim(boletim(1, { data_coleta: null }), agora), null);
});

test('boletim sem fonte não é exibido', () => {
  assert.equal(formatarBoletim(boletim(1, { fonte: '' }), agora), null);
});

test('ausência de boletim retorna null', () => {
  assert.equal(formatarBoletim(null, agora), null);
});
