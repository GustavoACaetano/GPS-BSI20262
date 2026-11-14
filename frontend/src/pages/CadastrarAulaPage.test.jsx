import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CadastrarAulaPage from './CadastrarAulaPage.jsx';
import { api } from '../api.js';
import { obterCodigoEdicao } from '../codigosEdicao.js';

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(api, 'listarPraias').mockResolvedValue({ dados: [{ id: 3, nome: 'Camburi', municipio: 'Vitória' }] });
});
afterEach(() => vi.restoreAllMocks());

const renderizar = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CadastrarAulaPage />
    </MemoryRouter>,
  );

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
  preencher('Nome do instrutor', 'Ana Lima');
  preencher('Contato', '(27) 99999-0000');
  fireEvent.click(screen.getByRole('button', { name: 'Publicar aula' }));
}

test('publicação imediata mostra o código de edição e o link da aula', async () => {
  vi.spyOn(api, 'cadastrarAula').mockResolvedValue({
    aula: { id: 20, titulo: 'Surf para iniciantes' },
    publicada: true,
    codigoEdicao: 'abc123',
  });
  renderizar();

  await cadastrar();

  expect(await screen.findByRole('heading', { name: 'Aula publicada!' })).toBeInTheDocument();
  expect(screen.getByText('abc123')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ver aula publicada' })).toHaveAttribute('href', '/atividades/20');
  expect(screen.getByRole('link', { name: 'Editar aula' })).toHaveAttribute('href', '/aulas/20/editar');
  expect(obterCodigoEdicao(20)).toBe('abc123');
});

test('com moderação, informa que a aula aguarda aprovação', async () => {
  vi.spyOn(api, 'cadastrarAula').mockResolvedValue({
    aula: { id: 21, titulo: 'Surf para iniciantes' },
    publicada: false,
    codigoEdicao: 'def456',
  });
  renderizar();

  await cadastrar();

  expect(await screen.findByRole('heading', { name: 'Aula enviada para aprovação' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Ver aula publicada' })).not.toBeInTheDocument();
});
