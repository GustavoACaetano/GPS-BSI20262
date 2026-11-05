import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useDados } from './hooks.js';

afterEach(() => vi.useRealTimers());

describe('useDados', () => {
  test('começa carregando e depois expõe os dados', async () => {
    const { result } = renderHook(() => useDados(async () => ['Camburi'], []));

    expect(result.current.carregando).toBe(true);
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.dados).toEqual(['Camburi']);
    expect(result.current.erro).toBeNull();
  });

  test('expõe o erro quando o carregamento falha', async () => {
    const falha = new Error('Sem conexão');
    const { result } = renderHook(() => useDados(() => Promise.reject(falha), []));

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.erro).toBe(falha);
    expect(result.current.dados).toBeNull();
  });

  test('recarrega periodicamente quando há intervalo', async () => {
    vi.useFakeTimers();
    let contador = 0;
    const carregar = vi.fn(async () => ++contador);
    const { result, unmount } = renderHook(() => useDados(carregar, [], 1000));

    await act(async () => {});
    expect(result.current.dados).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.dados).toBe(2);
    expect(result.current.carregando).toBe(false);

    unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(carregar).toHaveBeenCalledTimes(2);
  });
});
