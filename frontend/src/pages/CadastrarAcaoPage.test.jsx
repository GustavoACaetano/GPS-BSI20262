import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';
import CadastrarAcaoPage from './CadastrarAcaoPage.jsx';
import MinhaAreaPage from './MinhaAreaPage.jsx';
import { api } from '../api.js';
import { ORGANIZADOR, renderizar } from '../test/renderizar.jsx';

beforeEach(() => {
  vi.spyOn(api, 'listarPraias').mockResolvedValue({ dados: [{ id: 1, nome: 'Camburi', municipio: 'Vitória' }] });
});
afterEach(() => vi.restoreAllMocks());

test('cadastro de ação sugere o organizador logado como responsável', async () => {
  renderizar(<CadastrarAcaoPage />, { organizador: ORGANIZADOR });

  expect(screen.getByLabelText(/^Organização responsável/)).toHaveValue('Ana Lima');
  expect(screen.getByLabelText(/^Contato/)).toHaveValue('(27) 99999-0000');
  await screen.findByRole('option', { name: 'Camburi · Vitória' });
});

test('Minha área separa aulas e ações e não deixa editar ação já realizada', async () => {
  const futura = new Date(Date.now() + 7 * 864e5).toISOString();
  const passada = new Date(Date.now() - 864e5).toISOString();
  const praia = { id: 1, nome: 'Camburi', municipio: 'Vitória' };
  vi.spyOn(api, 'listarMinhasAtividades').mockResolvedValue({
    dados: [
      { id: 1, tipo: 'AULA', titulo: 'Surf', modalidade: 'Surf', praia, diasSemana: 'Sáb', horaInicio: '07:00', horaFim: '08:00', status: 'ATIVO', publicada: true },
      { id: 2, tipo: 'ACAO_COMUNITARIA', titulo: 'Mutirão futuro', praia, dataInicio: futura, interessados: 3, status: 'ATIVO', publicada: false },
      { id: 3, tipo: 'ACAO_COMUNITARIA', titulo: 'Mutirão passado', praia, dataInicio: passada, interessados: 9, status: 'ATIVO', publicada: true },
    ],
  });
  renderizar(<MinhaAreaPage />, { organizador: ORGANIZADOR });

  expect(await screen.findByRole('heading', { name: 'Minhas ações comunitárias' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Minhas aulas' })).toBeInTheDocument();

  const futuro = screen.getByText('Mutirão futuro').closest('li');
  expect(futuro).toHaveTextContent('Aguardando aprovação');
  expect(futuro.querySelector('a[href="/acoes/2/editar"]')).not.toBeNull();

  const passado = screen.getByText('Mutirão passado').closest('li');
  expect(passado).toHaveTextContent('Realizada');
  expect(passado.querySelector('a[href="/acoes/3/editar"]')).toBeNull();

  expect(screen.getByRole('link', { name: '+ Cadastrar ação' })).toHaveAttribute('href', '/acoes/nova');
});
