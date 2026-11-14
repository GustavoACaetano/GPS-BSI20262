import { afterEach, describe, expect, test, vi } from 'vitest';
import { api } from './api.js';

const respostaJson = (corpo, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => corpo,
});

afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  test('monta a URL ignorando parâmetros vazios', async () => {
    const fetch = vi.fn(async () => respostaJson({ dados: [] }));
    vi.stubGlobal('fetch', fetch);

    await api.listarPraias({ busca: 'camburi', municipio: '', pagina: undefined });

    expect(fetch).toHaveBeenCalledWith('/api/praias?busca=camburi');
  });

  test('não adiciona "?" quando não há parâmetros', async () => {
    const fetch = vi.fn(async () => respostaJson({}));
    vi.stubGlobal('fetch', fetch);

    await api.obterPraia(3);

    expect(fetch).toHaveBeenCalledWith('/api/praias/3');
  });

  test('listarAtividades envia o tipo junto com os demais parâmetros', async () => {
    const fetch = vi.fn(async () => respostaJson({ dados: [] }));
    vi.stubGlobal('fetch', fetch);

    await api.listarAtividades('AULA', { ordenar: 'praia' });

    expect(fetch).toHaveBeenCalledWith('/api/atividades?tipo=AULA&ordenar=praia');
  });

  test('retorna o corpo JSON em caso de sucesso', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({ atual: null, historico: [] })));

    await expect(api.obterBalneabilidade(1)).resolves.toEqual({ atual: null, historico: [] });
  });

  test('lança a mensagem de erro enviada pela API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({ erro: 'Praia não encontrada.' }, 404)));

    await expect(api.obterPraia(99)).rejects.toThrow('Praia não encontrada.');
  });

  test('cadastrarAula envia POST com o corpo em JSON', async () => {
    const fetch = vi.fn(async () => respostaJson({ codigoEdicao: 'abc' }, 201));
    vi.stubGlobal('fetch', fetch);

    await api.cadastrarAula({ titulo: 'Surf' });

    const [url, opcoes] = fetch.mock.calls[0];
    expect(url).toBe('/api/atividades/aulas');
    expect(opcoes.method).toBe('POST');
    expect(opcoes.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(opcoes.body)).toEqual({ titulo: 'Surf' });
  });

  test('editarAula envia PUT com o código de edição no cabeçalho', async () => {
    const fetch = vi.fn(async () => respostaJson({ aula: {} }));
    vi.stubGlobal('fetch', fetch);

    await api.editarAula(20, { titulo: 'Surf' }, 'segredo');

    const [url, opcoes] = fetch.mock.calls[0];
    expect(url).toBe('/api/atividades/aulas/20');
    expect(opcoes.method).toBe('PUT');
    expect(opcoes.headers['X-Codigo-Edicao']).toBe('segredo');
  });

  test('erros de validação trazem os campos inválidos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respostaJson({ erro: 'Revise os campos destacados.', campos: { titulo: 'Obrigatório' } }, 400)),
    );

    await expect(api.cadastrarAula({})).rejects.toMatchObject({
      message: 'Revise os campos destacados.',
      status: 400,
      campos: { titulo: 'Obrigatório' },
    });
  });

  test('lança mensagem genérica quando a resposta não é JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 502, json: async () => Promise.reject(new Error()) })),
    );

    await expect(api.obterAtividade(1)).rejects.toThrow('Falha ao carregar dados (502).');
  });
});
