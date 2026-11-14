import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import CadastrarAulaPage from './CadastrarAulaPage.jsx';
import { api } from '../api.js';
import { ORGANIZADOR, renderizar } from '../test/renderizar.jsx';

beforeEach(() => {
  vi.spyOn(api, 'listarPraias').mockResolvedValue({ dados: [{ id: 3, nome: 'Camburi', municipio: 'Vitória' }] });
});
afterEach(() => vi.restoreAllMocks());

const abrir = () => renderizar(<CadastrarAulaPage />, { organizador: ORGANIZADOR });

async function cadastrar() {
  await screen.findByRole('option', { name: 'Camburi · Vitória' });
  const preencher = (rotulo, valor) =>
    fireEvent.change(screen.getByLabelText(new RegExp(`^${rotulo}`)), { target: { value: valor } });
  preencher('Título', 'Surf para iniciantes');
  preencher('Modalidade', 'Surf');
  preencher('Praia', '3');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Sáb' }));
  preencher('Início', '07:00');
  preencher('Término', '08:30');
  fireEvent.click(screen.getByRole('button', { name: 'Publicar aula' }));
}

test('sugere o organizador logado como instrutor e contato', async () => {
  abrir();

  expect(screen.getByLabelText(/^Nome do instrutor/)).toHaveValue('Ana Lima');
  expect(screen.getByLabelText(/^Contato/)).toHaveValue('(27) 99999-0000');
  await screen.findByRole('option', { name: 'Camburi · Vitória' });
});

test('publicação imediata mostra o link da aula', async () => {
  const cadastrarAula = vi
    .spyOn(api, 'cadastrarAula')
    .mockResolvedValue({ id: 20, titulo: 'Surf para iniciantes', publicada: true });
  abrir();

  await cadastrar();

  expect(await screen.findByRole('heading', { name: 'Aula publicada!' })).toBeInTheDocument();
  expect(cadastrarAula.mock.calls[0][0]).toMatchObject({ instrutor: 'Ana Lima', praiaId: 3 });
  expect(screen.getByRole('link', { name: 'Ver aula publicada' })).toHaveAttribute('href', '/atividades/20');
  expect(screen.getByRole('link', { name: 'Ir para Minha área' })).toHaveAttribute('href', '/minha-area');
});

test('com moderação, informa que a aula aguarda aprovação', async () => {
  vi.spyOn(api, 'cadastrarAula').mockResolvedValue({ id: 21, titulo: 'Surf para iniciantes', publicada: false });
  abrir();

  await cadastrar();

  expect(await screen.findByRole('heading', { name: 'Aula enviada para aprovação' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Ver aula publicada' })).not.toBeInTheDocument();
});
