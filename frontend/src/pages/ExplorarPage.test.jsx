import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import ExplorarPage, { lerFiltros, paraConsulta, paraUrl, resumoResultados } from './ExplorarPage.jsx';
import { api } from '../api.js';
import { renderizar } from '../test/renderizar.jsx';

// PBI-09: filtros combinados com atualização dinâmica.

const camburi = {
  id: 3, nome: 'Camburi', municipio: 'Vitória',
  balneabilidade: { status: 'PROPRIA', pendenteAtualizacao: false },
};
const itapua = { id: 6, nome: 'Itapuã', municipio: 'Vila Velha', balneabilidade: null };
const praia = { id: 3, nome: 'Camburi', municipio: 'Vitória' };

const aula = { id: 1, tipo: 'AULA', status: 'ATIVO', titulo: 'Surf para iniciantes', modalidade: 'Surf', praia, diasSemana: 'Sáb', horaInicio: '07:00', horaFim: '08:00', instrutor: 'Ana' };
const evento = { id: 2, tipo: 'EVENTO', status: 'ATIVO', titulo: 'Open de Surf', modalidade: 'Surf', praia, dataInicio: '2026-12-05T12:00:00.000Z', localDetalhe: 'Píer', gratuito: true, valorInscricao: null, limiteVagas: 40 };

let explorar;
beforeEach(() => {
  explorar = vi.spyOn(api, 'explorar').mockResolvedValue({ dados: [aula, evento], total: 2, contagem: { AULA: 1, EVENTO: 1 } });
  vi.spyOn(api, 'listarPraias').mockImplementation(async ({ municipio }) => ({
    dados: [camburi, itapua].filter((p) => !municipio || p.municipio === municipio),
  }));
  vi.spyOn(api, 'listarModalidades').mockResolvedValue({ dados: ['Futevôlei', 'Surf'] });
});
afterEach(() => vi.restoreAllMocks());

const abrir = (rota = '/explorar') => renderizar(<ExplorarPage />, { rota, caminho: '/explorar' });
const ultimaConsulta = () => explorar.mock.calls.at(-1)[0];

describe('lerFiltros / paraConsulta', () => {
  test('lê os filtros da URL ignorando categorias desconhecidas', () => {
    const filtros = lerFiltros(new URLSearchParams('categorias=AULA,FESTA,EVENTO&praia=3&propria=true'));
    expect(filtros).toMatchObject({ categorias: ['AULA', 'EVENTO'], praia: '3', propria: true, quando: '' });
  });

  test('converte o período escolhido em datas', () => {
    const consulta = paraConsulta({ ...lerFiltros(new URLSearchParams()), quando: '7dias' }, '2026-11-14');
    expect(consulta).toMatchObject({ de: '2026-11-14', ate: '2026-11-20', categorias: '', propria: undefined });
  });

  test('período personalizado só vale com as duas datas', () => {
    const base = { ...lerFiltros(new URLSearchParams()), quando: 'personalizado' };
    expect(paraConsulta({ ...base, de: '2026-12-01' }).de).toBeUndefined();
    expect(paraConsulta({ ...base, de: '2026-12-01', ate: '2026-12-03' })).toMatchObject({ de: '2026-12-01', ate: '2026-12-03' });
  });
});

describe('ExplorarPage', () => {
  test('mostra os resultados agrupados por categoria, com contagem', async () => {
    abrir();

    expect(await screen.findByText('2 atividades')).toBeInTheDocument();
    const aulas = screen.getByRole('region', { name: /Aulas/ });
    expect(within(aulas).getByText('Surf para iniciantes')).toBeInTheDocument();
    expect(within(aulas).getByText('1')).toHaveClass('contagem');
    expect(screen.getByRole('region', { name: /Eventos esportivos/ })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Ações comunitárias/ })).not.toBeInTheDocument();
  });

  test('combina categoria e praia, refazendo a busca a cada mudança', async () => {
    abrir();
    await screen.findByText('2 atividades');
    await screen.findByRole('option', { name: 'Camburi · Vitória' });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Eventos' }));
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ categorias: 'EVENTO' }));

    fireEvent.change(screen.getByLabelText('Praia'), { target: { value: '3' } });
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ categorias: 'EVENTO', praia: '3' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Aulas' }));
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ categorias: 'EVENTO,AULA', praia: '3' }));
  });

  test('aplica os filtros vindos da URL e mostra a balneabilidade da praia escolhida', async () => {
    abrir('/explorar?categorias=AULA&praia=3&propria=true');

    await waitFor(() =>
      expect(explorar).toHaveBeenCalledWith(expect.objectContaining({ categorias: 'AULA', praia: '3', propria: 'true' })),
    );
    expect(screen.getByRole('checkbox', { name: 'Aulas' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Só praias próprias/ })).toBeChecked();
    expect(await screen.findByText('Própria para banho')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver praia e boletins' })).toHaveAttribute('href', '/praias/3');
  });

  test('trocar o município limpa a praia e restringe a lista de praias', async () => {
    abrir('/explorar?praia=3');
    await screen.findByRole('option', { name: 'Camburi · Vitória' });

    fireEvent.change(screen.getByLabelText('Município'), { target: { value: 'Vila Velha' } });

    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ municipio: 'Vila Velha', praia: '' }));
    expect(await screen.findByRole('option', { name: 'Itapuã' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Camburi/ })).not.toBeInTheDocument();
  });

  test('filtra por modalidade e avisa que ações ficam de fora', async () => {
    abrir();
    await screen.findByRole('option', { name: 'Futevôlei' });

    fireEvent.change(screen.getByLabelText('Modalidade'), { target: { value: 'Futevôlei' } });

    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ modalidade: 'Futevôlei' }));
    expect(screen.getByText(/Ações comunitárias não têm modalidade/)).toBeInTheDocument();
  });

  test('período personalizado aguarda as duas datas', async () => {
    abrir('/explorar?quando=personalizado&de=2026-12-01');

    expect(await screen.findByText('Escolha as duas datas para filtrar pelo período.')).toBeInTheDocument();
    await waitFor(() => expect(ultimaConsulta().de).toBeUndefined());

    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-12-03' } });
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ de: '2026-12-01', ate: '2026-12-03' }));
  });

  test('sem resultados, oferece limpar os filtros', async () => {
    explorar.mockResolvedValue({ dados: [], total: 0, contagem: { AULA: 0 } });
    abrir('/explorar?categorias=AULA&modalidade=Surf');

    expect(await screen.findByText('Nenhum resultado')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpar busca e filtros' })[0]);

    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ categorias: '', modalidade: '' }));
    expect(screen.getByRole('checkbox', { name: 'Aulas' })).not.toBeChecked();
  });

  // --- PBI-13: pesquisa textual ---------------------------------------------------

  test('digitar no campo de busca refaz a consulta depois de uma pausa', async () => {
    abrir();
    await screen.findByText('2 atividades');

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'cambu' } });
    expect(ultimaConsulta().busca).toBe('');

    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ busca: 'cambu' }), { timeout: 2000 });
  });

  test('a busca vem da URL, combina com filtros e lista as praias encontradas', async () => {
    explorar.mockResolvedValue({
      dados: [aula], total: 1, contagem: { AULA: 1 },
      praias: [{ id: 3, nome: 'Camburi', municipio: 'Vitória', balneabilidade: null }],
    });
    abrir('/explorar?busca=camburi&municipio=Vit%C3%B3ria');

    expect(await screen.findByText('1 atividade e 1 praia')).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar')).toHaveValue('camburi');
    expect(ultimaConsulta()).toMatchObject({ busca: 'camburi', municipio: 'Vitória' });
    const praias = screen.getByRole('region', { name: /Praias/ });
    expect(within(praias).getByRole('link', { name: /Camburi/ })).toHaveAttribute('href', '/praias/3');
  });

  test('"Nenhum resultado" mostra sugestões que refazem a busca', async () => {
    explorar.mockResolvedValue({ dados: [], total: 0, contagem: {}, praias: [], sugestoes: { termos: ['Surf'], semFiltros: null } });
    abrir('/explorar?busca=surff');

    expect(await screen.findByText(/para "surff"/)).toBeInTheDocument();
    explorar.mockResolvedValue({ dados: [aula], total: 1, contagem: { AULA: 1 }, praias: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Surf' }));

    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ busca: 'Surf' }));
    await waitFor(() => expect(screen.getByLabelText('Buscar')).toHaveValue('Surf'));
  });

  test('sem resultados por causa dos filtros, oferece buscar só pela palavra', async () => {
    explorar.mockResolvedValue({ dados: [], total: 0, contagem: {}, praias: [], sugestoes: { termos: [], semFiltros: 3 } });
    abrir('/explorar?busca=camburi&categorias=AULA&modalidade=Surf');

    fireEvent.click(await screen.findByRole('button', { name: 'Buscar "camburi" sem os outros filtros (3 resultados)' }));

    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ busca: 'camburi', categorias: '', modalidade: '' }));
  });

  test('sem sugestões, dá dicas de busca', async () => {
    explorar.mockResolvedValue({ dados: [], total: 0, contagem: {}, praias: [], sugestoes: { termos: [], semFiltros: null } });
    abrir('/explorar?busca=zzzz');

    expect(await screen.findByText(/Confira a grafia/)).toBeInTheDocument();
  });
});

describe('paraUrl / resumoResultados', () => {
  test('paraUrl só leva valores preenchidos para a URL', () => {
    const vazio = lerFiltros(new URLSearchParams());
    expect(paraUrl({ ...vazio, busca: '  surf ', categorias: ['AULA'] })).toEqual({ busca: 'surf', categorias: 'AULA' });
    expect(paraUrl({ ...vazio, quando: 'hoje', de: '2026-01-01' })).toEqual({ quando: 'hoje' });
  });

  test('resumoResultados conta atividades e praias', () => {
    expect(resumoResultados({ total: 1 })).toBe('1 atividade');
    expect(resumoResultados({ total: 0, praias: [{}, {}] })).toBe('0 atividades e 2 praias');
  });
});
