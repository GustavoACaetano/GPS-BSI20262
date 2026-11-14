import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import AlterarStatusPage, { opcoesStatus, validarStatus } from './AlterarStatusPage.jsx';
import AtividadeDetalhePage from './AtividadeDetalhePage.jsx';
import { api, ErroApi } from '../api.js';
import { ORGANIZADOR, renderizar } from '../test/renderizar.jsx';

// PBI-12: adiar, cancelar ou reativar uma atividade.

afterEach(() => vi.restoreAllMocks());

const futuro = new Date(Date.now() + 7 * 864e5).toISOString();
const praia = { id: 1, nome: 'Camburi', municipio: 'Vitória' };
const evento = (extras = {}) => ({
  id: 60, tipo: 'EVENTO', titulo: 'Open de Vôlei', modalidade: 'Vôlei', status: 'ATIVO', avisoStatus: null,
  praia, localDetalhe: 'Quadra', dataInicio: futuro, gratuito: true, valorInscricao: null, limiteVagas: null,
  regulamento: 'R', responsavel: 'Liga', contato: 'x', descricao: null, interessados: 3, organizadorId: 5,
  publicada: true, ...extras,
});

const abrir = () =>
  renderizar(<AlterarStatusPage />, { rota: '/minha-area/status/60', caminho: '/minha-area/status/:id', organizador: ORGANIZADOR });

describe('regras', () => {
  test('opcoesStatus: ativa pode adiar ou cancelar; adiada também pode reativar', () => {
    expect(opcoesStatus('ATIVO').map((o) => o.valor)).toEqual(['ADIADO', 'CANCELADO']);
    expect(opcoesStatus('ADIADO').map((o) => o.valor)).toEqual(['ATIVO', 'ADIADO', 'CANCELADO']);
  });

  test('validarStatus exige aviso ao adiar/cancelar e confirmação ao cancelar', () => {
    expect(validarStatus({ status: '', aviso: '', confirmaCancelamento: false })).toHaveProperty('status');
    expect(validarStatus({ status: 'ADIADO', aviso: 'ok', confirmaCancelamento: false })).toHaveProperty('aviso');
    expect(validarStatus({ status: 'CANCELADO', aviso: 'Sem licença.', confirmaCancelamento: false })).toEqual({
      confirmaCancelamento: 'Confirme que entende que o cancelamento é definitivo.',
    });
    expect(validarStatus({ status: 'ATIVO', aviso: '', confirmaCancelamento: false })).toEqual({});
  });
});

describe('AlterarStatusPage', () => {
  test('adia com aviso e informa quantos inscritos foram avisados', async () => {
    vi.spyOn(api, 'obterMinhaAtividade').mockResolvedValue(evento());
    const alterar = vi.spyOn(api, 'alterarStatus').mockResolvedValue({
      atividade: evento({ status: 'ADIADO', avisoStatus: 'Ressaca no mar; nova data em breve.' }),
      avisados: 2,
    });
    abrir();

    fireEvent.click(await screen.findByRole('radio', { name: /^Adiar/ }));
    fireEvent.change(screen.getByLabelText(/^Aviso/), { target: { value: ' Ressaca no mar; nova data em breve. ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar status' }));

    expect(await screen.findByRole('heading', { name: 'Status atualizado' })).toBeInTheDocument();
    expect(screen.getByText(/Enviamos o aviso por e-mail para 2 inscritos/)).toBeInTheDocument();
    expect(alterar).toHaveBeenCalledWith(60, 'ADIADO', 'Ressaca no mar; nova data em breve.');
  });

  test('cancelar exige confirmar que é definitivo', async () => {
    vi.spyOn(api, 'obterMinhaAtividade').mockResolvedValue(evento());
    const alterar = vi.spyOn(api, 'alterarStatus').mockResolvedValue({
      atividade: evento({ status: 'CANCELADO', avisoStatus: 'Sem licença da prefeitura.' }),
      avisados: 0,
    });
    abrir();

    fireEvent.click(await screen.findByRole('radio', { name: /^Cancelar/ }));
    fireEvent.change(screen.getByLabelText(/^Aviso/), { target: { value: 'Sem licença da prefeitura.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar atividade' }));

    expect(await screen.findByText('Confirme que entende que o cancelamento é definitivo.')).toBeInTheDocument();
    expect(alterar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: /cancelamento é definitivo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar atividade' }));

    expect(await screen.findByText(/novas inscrições estão bloqueadas/)).toBeInTheDocument();
    expect(screen.getByText(/Nenhum inscrito deixou e-mail/)).toBeInTheDocument();
  });

  test('atividade adiada pode ser reativada, sem aviso', async () => {
    vi.spyOn(api, 'obterMinhaAtividade').mockResolvedValue(evento({ status: 'ADIADO', avisoStatus: 'Ressaca no mar.' }));
    const alterar = vi.spyOn(api, 'alterarStatus').mockResolvedValue({ atividade: evento(), avisados: 0 });
    abrir();

    expect(await screen.findByText('Ressaca no mar.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /^Reativar/ }));
    expect(screen.queryByLabelText(/^Aviso/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar status' }));

    await waitFor(() => expect(alterar).toHaveBeenCalledWith(60, 'ATIVO', 'Ressaca no mar.'));
    expect(await screen.findByText(/Atividade reativada/)).toBeInTheDocument();
  });

  test('atividade cancelada não mostra o formulário', async () => {
    vi.spyOn(api, 'obterMinhaAtividade').mockResolvedValue(evento({ status: 'CANCELADO', avisoStatus: 'Sem licença.' }));
    abrir();

    expect(await screen.findByText(/O cancelamento é definitivo/)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  test('mostra o erro da API', async () => {
    vi.spyOn(api, 'obterMinhaAtividade').mockResolvedValue(evento());
    vi.spyOn(api, 'alterarStatus').mockRejectedValue(new ErroApi('A atividade já aconteceu; o status não pode mais ser alterado.', 409));
    abrir();

    fireEvent.click(await screen.findByRole('radio', { name: /^Adiar/ }));
    fireEvent.change(screen.getByLabelText(/^Aviso/), { target: { value: 'Ressaca no mar.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar status' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('já aconteceu');
  });
});

describe('página da atividade (dono)', () => {
  test('mostra "Adiar ou cancelar" e esconde as ações quando cancelada', async () => {
    vi.spyOn(api, 'obterAtividade').mockResolvedValue(evento());
    const { unmount } = renderizar(<AtividadeDetalhePage />, {
      rota: '/atividades/60', caminho: '/atividades/:id', organizador: ORGANIZADOR,
    });
    expect(await screen.findByRole('link', { name: 'Adiar ou cancelar' })).toHaveAttribute('href', '/minha-area/status/60');
    unmount();

    vi.spyOn(api, 'obterAtividade').mockResolvedValue(evento({ status: 'CANCELADO', avisoStatus: 'Sem licença.' }));
    renderizar(<AtividadeDetalhePage />, { rota: '/atividades/60', caminho: '/atividades/:id', organizador: ORGANIZADOR });
    expect(await screen.findByText('Sem licença.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Adiar ou cancelar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar este evento' })).not.toBeInTheDocument();
  });
});
