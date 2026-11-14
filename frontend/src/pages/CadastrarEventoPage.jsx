import { useState } from 'react';
import { Link } from 'react-router-dom';
import FormularioEvento, { EVENTO_VAZIO } from '../components/FormularioEvento.jsx';
import { api } from '../api.js';
import { useSessao } from '../sessao.jsx';

// PBI-07 Cadastrar e Publicar Eventos Esportivos (exige login do PBI-11)
export default function CadastrarEventoPage() {
  const { organizador } = useSessao();
  const [evento, setEvento] = useState(null);

  if (evento) {
    return (
      <section className="detalhe">
        <div className="painel painel--propria" role="status">
          <h1>{evento.publicada ? 'Evento publicado!' : 'Evento enviado para aprovação'}</h1>
          <p>
            {evento.publicada
              ? `"${evento.titulo}" já aparece na aba Eventos para atletas e espectadores.`
              : `"${evento.titulo}" ficará visível assim que a equipe GoBeach aprovar o cadastro.`}
          </p>
          <p className="texto-suave">Você pode editá-lo quando quiser em Minha área.</p>
        </div>

        <div className="acoes">
          {evento.publicada && (
            <Link to={`/atividades/${evento.id}`} className="botao">
              Ver evento publicado
            </Link>
          )}
          <Link to="/minha-area" className="botao botao--secundario">
            Ir para Minha área
          </Link>
          <button type="button" className="botao botao--secundario" onClick={() => setEvento(null)}>
            Cadastrar outro evento
          </button>
        </div>
      </section>
    );
  }

  // O organizador logado é sugerido como organizador do evento e contato.
  const inicial = {
    ...EVENTO_VAZIO,
    responsavel: organizador.nome,
    contato: organizador.telefone || organizador.email,
  };

  return (
    <section className="detalhe">
      <Link to="/eventos" className="voltar">← Todos os eventos</Link>
      <div className="titulo-pagina">
        <h1>Cadastrar evento esportivo</h1>
        <p>Divulgue seu campeonato ou torneio de praia e capte inscritos. Campos com * são obrigatórios.</p>
      </div>
      <FormularioEvento
        inicial={inicial}
        rotuloEnviar="Publicar evento"
        aoEnviar={async (valores) => setEvento(await api.cadastrarEvento(valores))}
      />
    </section>
  );
}
