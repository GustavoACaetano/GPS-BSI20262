import { EventoCard } from '../components/AtividadeCards.jsx';
import { Carregando, Erro, Vazio } from '../components/Estado.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';

// PBI-04 Consultar Eventos Esportivos (ordem cronológica, próximos no topo)
export default function EventosPage() {
  const { dados, erro, carregando } = useDados(() => api.listarAtividades('EVENTO'), []);

  return (
    <>
      <div className="titulo-pagina">
        <h1>Eventos esportivos</h1>
        <p>Campeonatos e torneios nas praias, dos mais próximos aos mais distantes.</p>
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
