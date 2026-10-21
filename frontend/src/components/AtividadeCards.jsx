import { Link } from 'react-router-dom';
import SeloStatus from './SeloStatus.jsx';
import { formatarDataEvento, formatarMoeda } from '../formatacao.js';

function Cabecalho({ atividade, rotulo }) {
  return (
    <div className="card__cabecalho">
      <span className="rotulo">{rotulo}</span>
      <SeloStatus status={atividade.status} />
    </div>
  );
}

function Praia({ praia }) {
  return (
    <Link to={`/praias/${praia.id}`} className="link-praia">
      {praia.nome} · {praia.municipio}
    </Link>
  );
}

// PBI-03
export function AulaCard({ aula, detalhe = false }) {
  return (
    <article className={`card card--atividade${aula.status !== 'ATIVO' ? ' card--inativa' : ''}`}>
      <Cabecalho atividade={aula} rotulo={aula.modalidade} />
      <h3 className="card__titulo">{aula.titulo}</h3>
      <dl className="detalhes">
        <dt>Praia</dt>
        <dd><Praia praia={aula.praia} /></dd>
        <dt>Dias</dt>
        <dd>{aula.diasSemana}</dd>
        <dt>Horário</dt>
        <dd>{aula.horaInicio} – {aula.horaFim}</dd>
        <dt>Instrutor</dt>
        <dd>{aula.instrutor}</dd>
      </dl>
      {!detalhe && (
        <Link to={`/atividades/${aula.id}`} className="botao">
          Ver Detalhes e Inscrição
        </Link>
      )}
    </article>
  );
}

// PBI-04
export function EventoCard({ evento, detalhe = false }) {
  return (
    <article className={`card card--atividade${evento.status !== 'ATIVO' ? ' card--inativa' : ''}`}>
      <Cabecalho atividade={evento} rotulo={evento.modalidade} />
      <h3 className="card__titulo">{evento.titulo}</h3>
      <dl className="detalhes">
        <dt>Quando</dt>
        <dd>{formatarDataEvento(evento.dataInicio)}</dd>
        <dt>Praia</dt>
        <dd><Praia praia={evento.praia} /></dd>
        <dt>Local</dt>
        <dd>{evento.localDetalhe}</dd>
        <dt>Entrada</dt>
        <dd>
          {evento.gratuito ? (
            <span className="tag tag--propria">Gratuito</span>
          ) : (
            <span className="tag tag--pago">Taxa de {formatarMoeda(evento.valorInscricao)}</span>
          )}
        </dd>
      </dl>
      {!detalhe && (
        <Link to={`/atividades/${evento.id}`} className="botao botao--secundario">
          Ver detalhes
        </Link>
      )}
    </article>
  );
}

// PBI-05
export function AcaoCard({ acao, detalhe = false }) {
  return (
    <article className={`card card--atividade${acao.status !== 'ATIVO' ? ' card--inativa' : ''}`}>
      <Cabecalho atividade={acao} rotulo="Ação comunitária" />
      <h3 className="card__titulo">{acao.titulo}</h3>
      <p className="objetivo">{acao.objetivoAmbiental}</p>
      <dl className="detalhes">
        <dt>Quando</dt>
        <dd>{formatarDataEvento(acao.dataInicio)}</dd>
        <dt>Praia</dt>
        <dd><Praia praia={acao.praia} /></dd>
        <dt>Encontro</dt>
        <dd>{acao.pontoEncontro}</dd>
      </dl>
      {acao.recomendacoes.length > 0 && (
        <div className="recomendacoes">
          <strong>Recomendações</strong>
          <ul>
            {acao.recomendacoes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="contador" aria-live="polite">
        <strong>{acao.interessados}</strong> voluntários confirmados
      </p>
      {!detalhe && (
        <Link to={`/atividades/${acao.id}`} className="botao botao--secundario">
          Ver detalhes
        </Link>
      )}
    </article>
  );
}
