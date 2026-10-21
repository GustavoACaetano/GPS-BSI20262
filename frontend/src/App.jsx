import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import PraiasPage from './pages/PraiasPage.jsx';
import PraiaDetalhePage from './pages/PraiaDetalhePage.jsx';
import AulasPage from './pages/AulasPage.jsx';
import EventosPage from './pages/EventosPage.jsx';
import AcoesPage from './pages/AcoesPage.jsx';
import AtividadeDetalhePage from './pages/AtividadeDetalhePage.jsx';

const ABAS = [
  { para: '/praias', rotulo: 'Praias' },
  { para: '/aulas', rotulo: 'Aulas' },
  { para: '/eventos', rotulo: 'Eventos' },
  { para: '/acoes', rotulo: 'Ações' },
];

export default function App() {
  return (
    <>
      <header className="topo">
        <div className="container topo__conteudo">
          <NavLink to="/praias" className="marca">
            <span aria-hidden="true">🌊</span> GoBeach
          </NavLink>
          <span className="topo__regiao">Grande Vitória · ES</span>
        </div>
        <nav className="abas" aria-label="Categorias">
          <div className="container abas__lista">
            {ABAS.map((aba) => (
              <NavLink
                key={aba.para}
                to={aba.para}
                className={({ isActive }) => `aba${isActive ? ' aba--ativa' : ''}`}
              >
                {aba.rotulo}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="container principal">
        <Routes>
          <Route path="/" element={<Navigate to="/praias" replace />} />
          <Route path="/praias" element={<PraiasPage />} />
          <Route path="/praias/:id" element={<PraiaDetalhePage />} />
          <Route path="/aulas" element={<AulasPage />} />
          <Route path="/eventos" element={<EventosPage />} />
          <Route path="/acoes" element={<AcoesPage />} />
          <Route path="/atividades/:id" element={<AtividadeDetalhePage />} />
          <Route path="*" element={<p className="estado">Página não encontrada.</p>} />
        </Routes>
      </main>

      <footer className="rodape">
        <div className="container">
          GoBeach · MVP · Ardísia Software — Dados de balneabilidade de fontes oficiais.
        </div>
      </footer>
    </>
  );
}
