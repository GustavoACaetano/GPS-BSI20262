import { describe, expect, test } from 'vitest';
import {
  calcularPeriodo,
  deDataHoraLocal,
  formatarData,
  formatarDataEvento,
  formatarDataHora,
  formatarMoeda,
  paraDataHoraLocal,
} from './formatacao.js';

// Intl usa espaço não separável em alguns formatos; normaliza para comparar.
const normalizar = (texto) => texto.replace(/\s/g, ' ');

describe('formatacao', () => {
  test('formatarData converte YYYY-MM-DD sem mudar o dia por fuso', () => {
    expect(formatarData('2026-10-01')).toBe('01/10/2026');
  });

  test('formatarDataHora usa o fuso de São Paulo', () => {
    expect(formatarDataHora('2026-10-21T02:30:00Z')).toBe('20/10/2026, 23:30');
  });

  test('formatarDataEvento inclui dia da semana e horário', () => {
    const texto = formatarDataEvento('2026-11-07T12:00:00Z');
    expect(texto).toMatch(/sáb/);
    expect(texto).toMatch(/07/);
    expect(texto).toMatch(/09:00/);
  });

  test('formatarMoeda formata em reais', () => {
    expect(normalizar(formatarMoeda(50))).toBe('R$ 50,00');
    expect(normalizar(formatarMoeda(1234.5))).toBe('R$ 1.234,50');
  });

  test('paraDataHoraLocal e deDataHoraLocal convertem no horário de Brasília', () => {
    expect(paraDataHoraLocal('2027-03-21T02:30:00.000Z')).toEqual({ data: '2027-03-20', hora: '23:30' });
    expect(deDataHoraLocal('2027-03-20', '23:30').toISOString()).toBe('2027-03-21T02:30:00.000Z');
  });

  // 2026-11-14 é sábado; 2026-11-16 é segunda; 2026-11-15 é domingo.
  test.each([
    ['hoje', '2026-11-16', { de: '2026-11-16', ate: '2026-11-16' }],
    ['fim-de-semana', '2026-11-16', { de: '2026-11-21', ate: '2026-11-22' }],
    ['fim-de-semana', '2026-11-14', { de: '2026-11-14', ate: '2026-11-15' }],
    ['fim-de-semana', '2026-11-15', { de: '2026-11-15', ate: '2026-11-15' }],
    ['7dias', '2026-12-28', { de: '2026-12-28', ate: '2027-01-03' }],
    ['30dias', '2026-11-16', { de: '2026-11-16', ate: '2026-12-15' }],
    ['', '2026-11-16', null],
  ])('calcularPeriodo(%s) a partir de %s', (periodo, hoje, esperado) => {
    expect(calcularPeriodo(periodo, hoje)).toEqual(esperado);
  });

  test('calcularPeriodo personalizado exige as duas datas em ordem', () => {
    expect(calcularPeriodo('personalizado', '2026-11-16', { de: '2026-12-01', ate: '2026-12-03' })).toEqual({
      de: '2026-12-01', ate: '2026-12-03',
    });
    expect(calcularPeriodo('personalizado', '2026-11-16', { de: '2026-12-03', ate: '2026-12-01' })).toBeNull();
    expect(calcularPeriodo('personalizado', '2026-11-16', { de: '2026-12-03' })).toBeNull();
  });
});
