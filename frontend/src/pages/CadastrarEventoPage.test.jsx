import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';
import CadastrarEventoPage from './CadastrarEventoPage.jsx';
import AtividadeDetalhePage from './AtividadeDetalhePage.jsx';
import MinhaAreaPage from './MinhaAreaPage.jsx';
import { api } from '../api.js';
import { ORGANIZADOR, renderizar } from '../test/renderizar.jsx';

beforeEach(() => {
  vi.spyOn(api, 'listarPraias').mockResolvedValue({ dados: [{ id: 1, nome: 'Camburi', municipio: 'Vitória' }] });
});
afterEach(() => vi.restoreAllMocks());

const praia = { id: 1, nome: 'Camburi', municipio: 'Vitória' };
const evento = (extras = {}) => ({
  id: 60, tipo: 'EVENTO', titulo: 'Open de Vôlei', modalidade: 'Vôlei de praia', status: 'ATIVO', praia,
  localDetalhe: 'Quadra 2', dataInicio: new Date(Date.now() + 7 * 864e5).toISOString(), gratuito: true,
  valorInscricao: null, limiteVagas: 32, regulamento: 'Duplas livres.\nSets de 21 pontos.',
  responsavel: 'Liga', contato: '27 9', descricao: null, interessados: 0, organizadorId: 5, publicada: true,
  ...extras,
});

test('cadastro de evento sugere o organizador logado e o contato', async () => {
  renderizar(<CadastrarEventoPage />, { organizador: ORGANIZADOR });

  expect(screen.getByLabelText(/^Organizador do evento/)).toHaveValue('Ana Lima');
  expect(screen.getByLabelText(/^Contato/)).toHaveValue('(27) 99999-0000');
  await screen.findByRole('option', { name: 'Camburi · Vitória' });
});

test('página do evento mostra o regulamento e o link de edição só para o dono', async () => {
  vi.spyOn(api, 'obterAtividade').mockResolvedValue(evento());
  renderizar(<AtividadeDetalhePage />, { rota: '/atividades/60', caminho: '/atividades/:id', organizador: ORGANIZADOR });

  expect(await screen.findByRole('heading', { name: 'Regulamento' })).toBeInTheDocument();
  expect(screen.getByText(/Sets de 21 pontos/)).toHaveClass('texto-preformatado');
  expect(screen.getByRole('link', { name: 'Editar este evento' })).toHaveAttribute('href', '/eventos/60/editar');
});

test('outro organizador não vê o link de edição do evento', async () => {
  vi.spyOn(api, 'obterAtividade').mockResolvedValue(evento({ organizadorId: 99 }));
  renderizar(<AtividadeDetalhePage />, { rota: '/atividades/60', caminho: '/atividades/:id', organizador: ORGANIZADOR });

  await screen.findByRole('heading', { name: 'Regulamento' });
  expect(screen.queryByRole('link', { name: 'Editar este evento' })).not.toBeInTheDocument();
});

test('Minha área lista os eventos do organizador com as vagas', async () => {
  vi.spyOn(api, 'listarMinhasAtividades').mockResolvedValue({ dados: [evento()] });
  renderizar(<MinhaAreaPage />, { organizador: ORGANIZADOR });

  expect(await screen.findByRole('heading', { name: 'Meus eventos esportivos' })).toBeInTheDocument();
  const item = screen.getByText('Open de Vôlei').closest('li');
  expect(item).toHaveTextContent('32 vagas');
  expect(item.querySelector('a[href="/eventos/60/editar"]')).not.toBeNull();
  expect(screen.getByRole('link', { name: '+ Cadastrar evento' })).toHaveAttribute('href', '/eventos/novo');
});
