import { describe, expect, test } from 'vitest';
import {
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
});
