import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FormularioAcao, { ACAO_VAZIA, acaoParaFormulario, linhasRecomendacoes, validarAcao } from './FormularioAcao.jsx';
import { api, ErroApi } from '../api.js';

beforeEach(() => {
  vi.spyOn(api, 'listarPraias').mockResolvedValue({ dados: [{ id: 1, nome: 'Camburi', municipio: 'Vitória' }] });
});
afterEach(() => vi.restoreAllMocks());

const AGORA = new Date('2026-11-14T15:00:00Z'); // 12:00 em Brasília
const ano = new Date().getFullYear() + 1;

const preencher = (rotulo, valor) =>
  fireEvent.change(screen.getByLabelText(new RegExp(`^${rotulo}`)), { target: { value: valor } });

async function preencherAcaoValida() {
  await screen.findByRole('option', { name: 'Camburi · Vitória' });
  preencher('Título', 'Mutirão de Camburi');
  preencher('Objetivo ecológico', 'Retirar resíduos da areia.');
  preencher('Apoio local', 'Prefeitura de Vitória');
  preencher('Praia', '1');
  preencher('Ponto de encontro', 'Píer de Iemanjá');
  preencher('Data', `${ano}-03-21`);
  preencher('Horário de início', '08:00');
  preencher('Recomendações', 'Levar luvas\n\n  Usar protetor solar  ');
  preencher('Organização responsável', 'Instituto Orla Limpa');
  preencher('Contato', 'voluntarios@orlalimpa.org');
}

describe('validarAcao', () => {
  test('aponta os campos obrigatórios, inclusive o objetivo ecológico', () => {
    expect(Object.keys(validarAcao(ACAO_VAZIA, AGORA)).sort()).toEqual([
      'contato', 'data', 'hora', 'objetivoAmbiental', 'pontoEncontro', 'praiaId', 'responsavel', 'titulo',
    ]);
  });

  test('exige data futura no horário de Brasília', () => {
    const base = {
      ...ACAO_VAZIA,
      titulo: 'A', objetivoAmbiental: 'B', praiaId: '1', pontoEncontro: 'C', responsavel: 'D', contato: 'E',
    };
    expect(validarAcao({ ...base, data: '2026-11-14', hora: '11:59' }, AGORA)).toEqual({
      data: 'A ação deve acontecer em uma data futura.',
    });
    expect(validarAcao({ ...base, data: '2026-11-14', hora: '12:01' }, AGORA)).toEqual({});
  });

  test('limita as recomendações a 10', () => {
    const recomendacoes = Array.from({ length: 11 }, (_, i) => `Item ${i}`).join('\n');
    expect(validarAcao({ ...ACAO_VAZIA, recomendacoes }, AGORA).recomendacoes).toMatch(/no máximo 10/);
  });
});

test('linhasRecomendacoes ignora linhas vazias e espaços', () => {
  expect(linhasRecomendacoes(' Levar luvas \n\n\nÁgua ')).toEqual(['Levar luvas', 'Água']);
});

test('acaoParaFormulario converte a ação da API para o horário de Brasília', () => {
  const valores = acaoParaFormulario({
    titulo: 'Mutirão', objetivoAmbiental: 'Limpar', apoioLocal: null, descricao: null,
    praia: { id: 1 }, pontoEncontro: 'Píer', dataInicio: '2027-03-21T11:00:00.000Z',
    responsavel: 'ONG', contato: 'x', recomendacoes: ['Levar luvas', 'Água'],
  });
  expect(valores).toMatchObject({
    praiaId: '1', data: '2027-03-21', hora: '08:00', apoioLocal: '', recomendacoes: 'Levar luvas\nÁgua',
  });
});

describe('FormularioAcao', () => {
  test('não envia e destaca os campos obrigatórios vazios', async () => {
    const aoEnviar = vi.fn();
    render(<FormularioAcao rotuloEnviar="Publicar ação" aoEnviar={aoEnviar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Publicar ação' }));

    expect(await screen.findByText('Objetivo ecológico é obrigatório.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Objetivo ecológico/)).toHaveAttribute('aria-invalid', 'true');
    expect(aoEnviar).not.toHaveBeenCalled();
    await screen.findByRole('option', { name: 'Camburi · Vitória' });
  });

  test('envia os dados com praia numérica e recomendações em lista', async () => {
    const aoEnviar = vi.fn().mockResolvedValue();
    render(<FormularioAcao rotuloEnviar="Publicar ação" aoEnviar={aoEnviar} />);

    await preencherAcaoValida();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar ação' }));

    await waitFor(() => expect(aoEnviar).toHaveBeenCalledTimes(1));
    expect(aoEnviar.mock.calls[0][0]).toMatchObject({
      titulo: 'Mutirão de Camburi',
      objetivoAmbiental: 'Retirar resíduos da areia.',
      apoioLocal: 'Prefeitura de Vitória',
      praiaId: 1,
      data: `${ano}-03-21`,
      hora: '08:00',
      recomendacoes: ['Levar luvas', 'Usar protetor solar'],
      responsavel: 'Instituto Orla Limpa',
    });
  });

  test('mostra os erros por campo devolvidos pela API', async () => {
    const aoEnviar = vi
      .fn()
      .mockRejectedValue(new ErroApi('Revise os campos destacados.', 400, { data: 'Cadastre ações com até 2 anos de antecedência.' }));
    render(<FormularioAcao rotuloEnviar="Publicar ação" aoEnviar={aoEnviar} />);

    await preencherAcaoValida();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar ação' }));

    expect(await screen.findByText('Cadastre ações com até 2 anos de antecedência.')).toBeInTheDocument();
  });
});
