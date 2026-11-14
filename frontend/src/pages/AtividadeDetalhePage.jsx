import { Link, useParams } from 'react-router-dom';
import { AcaoCard, AulaCard, EventoCard } from '../components/AtividadeCards.jsx';
import { Carregando, Erro } from '../components/Estado.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';
import { useSessao } from '../sessao.jsx';

const VOLTAR = {
  AULA: ['/aulas', 'Todas as aulas'],
  EVENTO: ['/eventos', 'Todos os eventos'],
  ACAO_COMUNITARIA: ['/acoes', 'Todas as ações'],
};

// Tipos que o organizador dono pode editar (PBI-06, PBI-07 e PBI-08).
const EDICAO = {
  AULA: ['aulas', 'Editar esta aula'],
  EVENTO: ['eventos', 'Editar este evento'],
  ACAO_COMUNITARIA: ['acoes', 'Editar esta ação'],
};

export default function AtividadeDetalhePage() {
  const { id } = useParams();
  const { dados: atividade, erro, carregando } = useDados(() => api.obterAtividade(id), [id], 10000);
  const { organizador } = useSessao();

  if (erro) return <Erro erro={erro} />;
  if (carregando && !atividade) return <Carregando />;

  const [voltarPara, voltarRotulo] = VOLTAR[atividade.tipo];

  return (
    <article className="detalhe">
      <Link to={voltarPara} className="voltar">← {voltarRotulo}</Link>
      <div className="detalhe__card">
        {atividade.tipo === 'AULA' && <AulaCard aula={atividade} detalhe />}
        {atividade.tipo === 'EVENTO' && <EventoCard evento={atividade} detalhe />}
        {atividade.tipo === 'ACAO_COMUNITARIA' && <AcaoCard acao={atividade} detalhe />}
      </div>

      {atividade.descricao && (
        <section>
          <h2>Sobre</h2>
          <p>{atividade.descricao}</p>
        </section>
      )}

      {atividade.regulamento && (
        <section className="painel painel--neutro">
          <h2>Regulamento</h2>
          <p className="texto-preformatado">{atividade.regulamento}</p>
        </section>
      )}

      <section className="painel painel--neutro">
        <h2>Responsável</h2>
        <p>
          {atividade.responsavel}
          {atividade.contato && <> · {atividade.contato}</>}
        </p>
        {EDICAO[atividade.tipo] && organizador && atividade.organizadorId === organizador.id && (
          <Link to={`/${EDICAO[atividade.tipo][0]}/${atividade.id}/editar`} className="link-editar">
            {EDICAO[atividade.tipo][1]}
          </Link>
        )}
      </section>

      <section className="painel painel--neutro">
        <h2>Inscrição</h2>
        <p className="texto-suave">
          {atividade.status === 'CANCELADO'
            ? 'Esta atividade foi cancelada pelo organizador.'
            : 'O formulário de inscrição online chega na próxima versão. Por enquanto, fale com o responsável pelo contato acima.'}
        </p>
      </section>
    </article>
  );
}
