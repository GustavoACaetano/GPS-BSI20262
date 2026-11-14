import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FormularioAula, { AULA_VAZIA, aulaParaFormulario, validarFormulario } from './FormularioAula.jsx';
import { api, ErroApi } from '../api.js';

const praias = {
  dados: [
    { id: 3, nome: 'Camburi', municipio: 'Vitória' },
    { id: 7, nome: 'Itaparica', municipio: 'Vila Velha' },
  ],
};

beforeEach(() => {
  vi.spyOn(api, 'listarPraias').mockResolvedValue(praias);
});
afterEach(() => vi.restoreAllMocks());

const preencher = (rotulo, valor) =>
  fireEvent.change(screen.getByLabelText(new RegExp(`^${rotulo}`)), { target: { value: valor } });

async function preencherAulaValida() {
  await screen.findByRole('option', { name: 'Camburi · Vitória' });
  preencher('Título', 'Surf para iniciantes');
  preencher('Modalidade', 'Surf');
  preencher('Praia', '3');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Sáb' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Dom' }));
  preencher('Início', '07:00');
  preencher('Término', '08:30');
  preencher('Nome do instrutor', 'Ana Lima');
  preencher('Contato', '(27) 99999-0000');
}

describe('validarFormulario', () => {
  test('aponta todos os campos obrigatórios vazios', () => {
    expect(Object.keys(validarFormulario(AULA_VAZIA)).sort()).toEqual([
      'contato', 'diasSemana', 'horaFim', 'horaInicio', 'instrutor', 'modalidade', 'praiaId', 'titulo',
    ]);
  });

  test('exige término depois do início', () => {
    const valores = {
      ...AULA_VAZIA,
      titulo: 'A', modalidade: 'Surf', praiaId: '3', diasSemana: ['Seg'],
      horaInicio: '09:00', horaFim: '09:00', instrutor: 'Ana', contato: 'x',
    };
    expect(validarFormulario(valores)).toEqual({ horaFim: 'O término deve ser depois do início.' });
  });
});

test('aulaParaFormulario converte a aula da API', () => {
  const valores = aulaParaFormulario({
    titulo: 'Surf', modalidade: 'Surf', praia: { id: 3 }, localDetalhe: null,
    diasSemana: 'Ter, Qui, Sáb', horaInicio: '07:00', horaFim: '08:00',
    instrutor: 'Ana', contato: null, descricao: null,
  });
  expect(valores.praiaId).toBe('3');
  expect(valores.diasSemana).toEqual(['Ter', 'Qui', 'Sáb']);
  expect(valores.contato).toBe('');
});

describe('FormularioAula', () => {
  test('não envia e destaca os campos obrigatórios vazios', async () => {
    const aoEnviar = vi.fn();
    render(<FormularioAula rotuloEnviar="Publicar aula" aoEnviar={aoEnviar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Publicar aula' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Revise os campos destacados.');
    expect(screen.getByText('Título é obrigatório.')).toBeInTheDocument();
    expect(screen.getByText('Selecione ao menos um dia da semana.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Título/)).toHaveAttribute('aria-invalid', 'true');
    expect(aoEnviar).not.toHaveBeenCalled();
  });

  test('envia os dados preenchidos com a praia numérica', async () => {
    const aoEnviar = vi.fn().mockResolvedValue();
    render(<FormularioAula rotuloEnviar="Publicar aula" aoEnviar={aoEnviar} />);

    await preencherAulaValida();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar aula' }));

    await waitFor(() => expect(aoEnviar).toHaveBeenCalledTimes(1));
    expect(aoEnviar.mock.calls[0][0]).toMatchObject({
      titulo: 'Surf para iniciantes',
      praiaId: 3,
      diasSemana: ['Sáb', 'Dom'],
      horaInicio: '07:00',
      horaFim: '08:30',
    });
  });

  test('mostra os erros por campo devolvidos pela API', async () => {
    const aoEnviar = vi
      .fn()
      .mockRejectedValue(new ErroApi('Revise os campos destacados.', 400, { praiaId: 'Praia não encontrada.' }));
    render(<FormularioAula rotuloEnviar="Publicar aula" aoEnviar={aoEnviar} />);

    await preencherAulaValida();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar aula' }));

    expect(await screen.findByText('Praia não encontrada.')).toBeInTheDocument();
  });

  test('desmarcar um dia remove-o da seleção', async () => {
    render(<FormularioAula rotuloEnviar="Salvar" aoEnviar={vi.fn()} />);
    const sabado = screen.getByRole('checkbox', { name: 'Sáb' });

    fireEvent.click(sabado);
    expect(sabado).toBeChecked();
    fireEvent.click(sabado);
    expect(sabado).not.toBeChecked();
    await screen.findByRole('option', { name: 'Camburi · Vitória' });
  });
});
