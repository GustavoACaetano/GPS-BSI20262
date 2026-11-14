import { afterEach, expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';
import InscritosPage, { linkContato } from './InscritosPage.jsx';
import { api } from '../api.js';
import { ORGANIZADOR, renderizar } from '../test/renderizar.jsx';

// PBI-10: lista de inscritos para o organizador dono.

afterEach(() => vi.restoreAllMocks());

const abrir = () =>
  renderizar(<InscritosPage />, { rota: '/minha-area/inscritos/7', caminho: '/minha-area/inscritos/:id', organizador: ORGANIZADOR });

test('linkContato abre e-mail ou WhatsApp', () => {
  expect(linkContato('bia@exemplo.com')).toBe('mailto:bia@exemplo.com');
  expect(linkContato('(27) 99999-1234')).toBe('https://wa.me/5527999991234');
  expect(linkContato('+55 27 99999-1234')).toBe('https://wa.me/5527999991234');
});

test('organizador vê os inscritos com links de contato', async () => {
  vi.spyOn(api, 'listarInscritos').mockResolvedValue({
    atividade: { id: 7, tipo: 'EVENTO', titulo: 'Open de Vôlei', limiteVagas: 32, inscritos: 2 },
    dados: [
      { id: 1, nome: 'Bia', contato: 'bia@exemplo.com', criadoEm: '2026-11-14T15:00:00.000Z' },
      { id: 2, nome: 'Caio', contato: '(27) 99999-1234', criadoEm: '2026-11-14T16:00:00.000Z' },
    ],
    total: 2,
  });
  abrir();

  expect(await screen.findByText(/de 32 vagas preenchidas/)).toBeInTheDocument();
  expect(screen.getAllByRole('row')).toHaveLength(3);
  expect(screen.getByRole('link', { name: 'bia@exemplo.com' })).toHaveAttribute('href', 'mailto:bia@exemplo.com');
  expect(screen.getByRole('link', { name: '(27) 99999-1234' })).toHaveAttribute('href', 'https://wa.me/5527999991234');
  expect(api.listarInscritos).toHaveBeenCalledWith('7');
});

test('sem inscritos mostra mensagem', async () => {
  vi.spyOn(api, 'listarInscritos').mockResolvedValue({
    atividade: { id: 7, tipo: 'AULA', titulo: 'Surf', limiteVagas: null, inscritos: 0 },
    dados: [],
    total: 0,
  });
  abrir();

  expect(await screen.findByText('Ainda não há inscritos nesta atividade.')).toBeInTheDocument();
});
