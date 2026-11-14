import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import { api } from '../api.js';
import { ProvedorSessao } from '../sessao.jsx';

export const ORGANIZADOR = { id: 5, nome: 'Ana Lima', email: 'ana@exemplo.com', telefone: '(27) 99999-0000' };

// Mostra o caminho atual, para conferir redirecionamentos.
export function LocalAtual() {
  const local = useLocation();
  return <output data-testid="local">{local.pathname + local.search}</output>;
}

// Renderiza com roteador e sessão; com `organizador`, começa logado.
export function renderizar(elemento, { rota = '/', caminho = '*', organizador } = {}) {
  localStorage.clear();
  if (organizador) {
    localStorage.setItem('gobeach:sessao', JSON.stringify({ token: 'tok', organizador }));
    vi.spyOn(api, 'obterPerfil').mockResolvedValue(organizador);
  }
  return render(
    <MemoryRouter initialEntries={[rota]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ProvedorSessao>
        <Routes>
          <Route path={caminho} element={elemento} />
          <Route path="*" element={<LocalAtual />} />
        </Routes>
      </ProvedorSessao>
    </MemoryRouter>,
  );
}
