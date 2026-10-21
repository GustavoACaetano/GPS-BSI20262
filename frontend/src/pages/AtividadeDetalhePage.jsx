import { Link, useParams } from 'react-router-dom';
import { AcaoCard, AulaCard, EventoCard } from '../components/AtividadeCards.jsx';
import { Carregando, Erro } from '../components/Estado.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';

const VOLTAR = {
  AULA: ['/aulas', 'Todas as aulas'],
  EVENTO: ['/eventos', 'Todos os eventos'],
  ACAO_COMUNITARIA: ['/acoes', 'Todas as ações'],
};

export default function AtividadeDetalhePage() {
  const { id } = useParams();
  const { dados: atividade, erro, carregando } = useDados(() => api.obterAtividade(id), [id], 10000);

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

      <section className="painel painel--neutro">
        <h2>Responsável</h2>
        <p>
          {atividade.responsavel}
          {atividade.contato && <> · {atividade.contato}</>}
        </p>
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
