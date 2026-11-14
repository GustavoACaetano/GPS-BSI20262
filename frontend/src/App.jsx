import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import PraiasPage from './pages/PraiasPage.jsx';
import PraiaDetalhePage from './pages/PraiaDetalhePage.jsx';
import AulasPage from './pages/AulasPage.jsx';
import EventosPage from './pages/EventosPage.jsx';
import AcoesPage from './pages/AcoesPage.jsx';
import AtividadeDetalhePage from './pages/AtividadeDetalhePage.jsx';
import ExplorarPage from './pages/ExplorarPage.jsx';
import CadastrarAulaPage from './pages/CadastrarAulaPage.jsx';
import EditarAulaPage from './pages/EditarAulaPage.jsx';
import CadastrarAcaoPage from './pages/CadastrarAcaoPage.jsx';
import CadastrarEventoPage from './pages/CadastrarEventoPage.jsx';
import EditarEventoPage from './pages/EditarEventoPage.jsx';
import EditarAcaoPage from './pages/EditarAcaoPage.jsx';
import EntrarPage from './pages/EntrarPage.jsx';
import CriarContaPage from './pages/CriarContaPage.jsx';
import RecuperarSenhaPage from './pages/RecuperarSenhaPage.jsx';
import RedefinirSenhaPage from './pages/RedefinirSenhaPage.jsx';
import MinhaAreaPage from './pages/MinhaAreaPage.jsx';
import InscritosPage from './pages/InscritosPage.jsx';
import { RotaProtegida, useSessao } from './sessao.jsx';

const ABAS = [
  { para: '/praias', rotulo: 'Praias' },
  { para: '/explorar', rotulo: 'Explorar' },
  { para: '/aulas', rotulo: 'Aulas' },
  { para: '/eventos', rotulo: 'Eventos' },
  { para: '/acoes', rotulo: 'Ações' },
];

function AcessoOrganizador() {
  const { organizador } = useSessao();
  return organizador ? (
    <NavLink to="/minha-area" className="topo__acesso" title="Minha área">
      <span aria-hidden="true">👤</span> <span className="topo__nome">{organizador.nome}</span>
    </NavLink>
  ) : (
    <NavLink to="/entrar" className="topo__acesso">Área do organizador</NavLink>
  );
}

export default function App() {
  return (
    <>
      <header className="topo">
        <div className="container topo__conteudo">
          <NavLink to="/praias" className="marca">
            <span aria-hidden="true">🌊</span> GoBeach
          </NavLink>
          <div className="topo__direita">
            <span className="topo__regiao">Grande Vitória · ES</span>
            <AcessoOrganizador />
          </div>
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
          <Route path="/explorar" element={<ExplorarPage />} />
          <Route path="/aulas" element={<AulasPage />} />
          <Route path="/aulas/nova" element={<RotaProtegida><CadastrarAulaPage /></RotaProtegida>} />
          <Route path="/aulas/:id/editar" element={<RotaProtegida><EditarAulaPage /></RotaProtegida>} />
          <Route path="/entrar" element={<EntrarPage />} />
          <Route path="/criar-conta" element={<CriarContaPage />} />
          <Route path="/recuperar-senha" element={<RecuperarSenhaPage />} />
          <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
          <Route path="/minha-area" element={<RotaProtegida><MinhaAreaPage /></RotaProtegida>} />
          <Route path="/minha-area/inscritos/:id" element={<RotaProtegida><InscritosPage /></RotaProtegida>} />
          <Route path="/eventos" element={<EventosPage />} />
          <Route path="/eventos/novo" element={<RotaProtegida><CadastrarEventoPage /></RotaProtegida>} />
          <Route path="/eventos/:id/editar" element={<RotaProtegida><EditarEventoPage /></RotaProtegida>} />
          <Route path="/acoes" element={<AcoesPage />} />
          <Route path="/acoes/nova" element={<RotaProtegida><CadastrarAcaoPage /></RotaProtegida>} />
          <Route path="/acoes/:id/editar" element={<RotaProtegida><EditarAcaoPage /></RotaProtegida>} />
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
