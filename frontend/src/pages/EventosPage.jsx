import { Link } from 'react-router-dom';
import { EventoCard } from '../components/AtividadeCards.jsx';
import { Carregando, Erro, Vazio } from '../components/Estado.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';

// PBI-04 Consultar Eventos Esportivos (ordem cronológica, próximos no topo)
// + PBI-07: acesso ao cadastro de eventos
export default function EventosPage() {
  const { dados, erro, carregando } = useDados(() => api.listarAtividades('EVENTO'), []);

  return (
    <>
      <div className="titulo-pagina titulo-pagina--acao">
        <div>
          <h1>Eventos esportivos</h1>
          <p>Campeonatos e torneios nas praias, dos mais próximos aos mais distantes.</p>
        </div>
        <Link to="/eventos/novo" className="botao">
          + Cadastrar evento
        </Link>
      </div>

      {erro && <Erro erro={erro} />}
      {carregando && !dados && <Carregando />}
      {dados && dados.dados.length === 0 && <Vazio>Nenhum evento agendado.</Vazio>}
      {dados && dados.dados.length > 0 && (
        <div className="grade">
          {dados.dados.map((evento) => (
            <EventoCard key={evento.id} evento={evento} />
          ))}
        </div>
      )}
    </>
  );
}
