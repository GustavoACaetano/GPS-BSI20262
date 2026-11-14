import { expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BuscaGlobal from './BuscaGlobal.jsx';
import { LocalAtual } from '../test/renderizar.jsx';

// PBI-13: busca no topo leva ao Explorar com a palavra-chave.

const renderizar = () =>
  render(
    <MemoryRouter initialEntries={['/praias']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <BuscaGlobal />
      <Routes>
        <Route path="*" element={<LocalAtual />} />
      </Routes>
    </MemoryRouter>,
  );

test('buscar no topo abre o Explorar com o termo', () => {
  renderizar();

  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar no GoBeach' }), { target: { value: '  vôlei camburi ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

  expect(screen.getByTestId('local')).toHaveTextContent('/explorar?busca=v%C3%B4lei%20camburi');
  expect(screen.getByRole('searchbox')).toHaveValue('');
});

test('busca vazia não navega', () => {
  renderizar();

  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '   ' } });
  fireEvent.submit(screen.getByRole('search'));

  expect(screen.getByTestId('local')).toHaveTextContent('/praias');
});
