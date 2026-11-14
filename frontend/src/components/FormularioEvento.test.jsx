import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FormularioEvento, {
  EVENTO_VAZIO,
  eventoParaFormulario,
  formularioParaEvento,
  validarEvento,
} from './FormularioEvento.jsx';
import { api } from '../api.js';

beforeEach(() => {
  vi.spyOn(api, 'listarPraias').mockResolvedValue({ dados: [{ id: 1, nome: 'Camburi', municipio: 'Vitória' }] });
});
afterEach(() => vi.restoreAllMocks());

const AGORA = new Date('2026-11-14T15:00:00Z');
const ano = new Date().getFullYear() + 1;

const preencher = (rotulo, valor) =>
  fireEvent.change(screen.getByLabelText(new RegExp(`^${rotulo}`)), { target: { value: valor } });

const completo = {
  ...EVENTO_VAZIO,
  titulo: 'Open', modalidade: 'Vôlei', regulamento: 'Duplas', praiaId: '1', localDetalhe: 'Quadra 2',
  data: '2026-12-05', hora: '09:00', responsavel: 'Liga', contato: '27 9',
};

describe('validarEvento', () => {
  test('aponta os campos obrigatórios, inclusive regulamento e contato', () => {
    expect(Object.keys(validarEvento(EVENTO_VAZIO, AGORA)).sort()).toEqual([
      'contato', 'data', 'hora', 'localDetalhe', 'modalidade', 'praiaId', 'regulamento', 'responsavel', 'titulo',
    ]);
  });

  test('exige valor quando o evento é pago', () => {
    expect(validarEvento({ ...completo, entrada: 'pago', valorInscricao: '' }, AGORA)).toEqual({
      valorInscricao: 'Informe o valor da inscrição.',
    });
    expect(validarEvento({ ...completo, entrada: 'pago', valorInscricao: '45,50' }, AGORA)).toEqual({});
  });

  test('limite de vagas é opcional, mas precisa ser inteiro positivo', () => {
    expect(validarEvento({ ...completo, limiteVagas: '' }, AGORA)).toEqual({});
    expect(validarEvento({ ...completo, limiteVagas: '0' }, AGORA).limiteVagas).toMatch(/inteiro maior que zero/);
    expect(validarEvento({ ...completo, limiteVagas: '2.5' }, AGORA).limiteVagas).toMatch(/inteiro maior que zero/);
  });

  test('exige data futura', () => {
    expect(validarEvento({ ...completo, data: '2026-11-14', hora: '11:00' }, AGORA)).toEqual({
      data: 'O evento deve acontecer em uma data futura.',
    });
  });
});

describe('conversões', () => {
  test('formularioParaEvento converte entrada, valor e vagas', () => {
    expect(formularioParaEvento({ ...completo, entrada: 'pago', valorInscricao: '45,50', limiteVagas: '32' })).toMatchObject({
      praiaId: 1, gratuito: false, valorInscricao: 45.5, limiteVagas: 32,
    });
    const gratuito = formularioParaEvento({ ...completo, entrada: 'gratuito', valorInscricao: '10', limiteVagas: ' ' });
    expect(gratuito).toMatchObject({ gratuito: true, valorInscricao: null, limiteVagas: null });
    expect(gratuito.entrada).toBeUndefined();
  });

  test('eventoParaFormulario usa o horário de Brasília e preenche entrada e vagas', () => {
    expect(
      eventoParaFormulario({
        titulo: 'Open', modalidade: 'Vôlei', descricao: null, regulamento: 'Duplas', praia: { id: 1 },
        localDetalhe: 'Quadra', dataInicio: '2027-01-10T12:00:00.000Z', gratuito: false, valorInscricao: 50,
        limiteVagas: null, responsavel: 'Liga', contato: '27 9',
      }),
    ).toMatchObject({ data: '2027-01-10', hora: '09:00', entrada: 'pago', valorInscricao: '50', limiteVagas: '' });
  });
});

describe('FormularioEvento', () => {
  test('o campo de valor só aparece para evento pago', async () => {
    render(<FormularioEvento rotuloEnviar="Publicar evento" aoEnviar={vi.fn()} />);

    expect(screen.queryByLabelText(/^Valor da inscrição/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Com taxa de inscrição' }));
    expect(screen.getByLabelText(/^Valor da inscrição/)).toBeInTheDocument();
    await screen.findByRole('option', { name: 'Camburi · Vitória' });
  });

  test('não envia sem regulamento e contato', async () => {
    const aoEnviar = vi.fn();
    render(<FormularioEvento rotuloEnviar="Publicar evento" aoEnviar={aoEnviar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Publicar evento' }));

    expect(await screen.findByText('Regulamento é obrigatório.')).toBeInTheDocument();
    expect(screen.getByText('Contato é obrigatório.')).toBeInTheDocument();
    expect(aoEnviar).not.toHaveBeenCalled();
    await screen.findByRole('option', { name: 'Camburi · Vitória' });
  });

  test('envia um evento pago com limite de vagas', async () => {
    const aoEnviar = vi.fn().mockResolvedValue();
    render(<FormularioEvento rotuloEnviar="Publicar evento" aoEnviar={aoEnviar} />);

    await screen.findByRole('option', { name: 'Camburi · Vitória' });
    preencher('Título', 'Torneio de Futevôlei');
    preencher('Modalidade', 'Futevôlei');
    preencher('Regulamento', 'Duplas mistas.\nSet único de 18 pontos.');
    preencher('Praia', '1');
    preencher('Local na praia', 'Posto 4');
    preencher('Data', `${ano}-01-10`);
    preencher('Horário de início', '09:00');
    fireEvent.click(screen.getByRole('radio', { name: 'Com taxa de inscrição' }));
    preencher('Valor da inscrição', '40');
    preencher('Limite de vagas', '32');
    preencher('Organizador do evento', 'Liga de Futevôlei');
    preencher('Contato', '(27) 98888-0001');
    fireEvent.click(screen.getByRole('button', { name: 'Publicar evento' }));

    await waitFor(() => expect(aoEnviar).toHaveBeenCalledTimes(1));
    expect(aoEnviar.mock.calls[0][0]).toMatchObject({
      titulo: 'Torneio de Futevôlei',
      regulamento: 'Duplas mistas.\nSet único de 18 pontos.',
      praiaId: 1,
      gratuito: false,
      valorInscricao: 40,
      limiteVagas: 32,
      contato: '(27) 98888-0001',
    });
  });
});
