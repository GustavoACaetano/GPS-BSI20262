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

const numero = (n) => n.toLocaleString('pt-BR');

// PBI-07 + PBI-10: vagas considerando os inscritos.
export const vagasRestantes = (atividade) =>
  atividade.limiteVagas ? Math.max(atividade.limiteVagas - (atividade.interessados || 0), 0) : null;

export function textoVagas(atividade) {
  if (!atividade.limiteVagas) return 'Sem limite de vagas';
  const restantes = vagasRestantes(atividade);
  if (restantes === 0) return 'Vagas esgotadas';
  return `${numero(restantes)} de ${numero(atividade.limiteVagas)} ${restantes === 1 ? 'vaga disponível' : 'vagas disponíveis'}`;
}

// PBI-10: contador de inscritos/interessados exibido nos cards.
function Contador({ quantidade, singular, plural }) {
  return (
    <p className="contador" aria-live="polite">
      <strong>{numero(quantidade || 0)}</strong> {quantidade === 1 ? singular : plural}
    </p>
  );
}

// PBI-03 (+ PBI-10: interessados)
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
      <Contador quantidade={aula.interessados} singular="interessado" plural="interessados" />
      {!detalhe && (
        <Link to={`/atividades/${aula.id}`} className="botao">
          Ver Detalhes e Inscrição
        </Link>
      )}
    </article>
  );
}

// PBI-04 (+ PBI-07: limite de vagas; PBI-10: inscritos)
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
        <dt>Vagas</dt>
        <dd className={vagasRestantes(evento) === 0 ? 'esgotado' : undefined}>{textoVagas(evento)}</dd>
      </dl>
      <Contador quantidade={evento.interessados} singular="inscrito" plural="inscritos" />
      {!detalhe && (
        <Link to={`/atividades/${evento.id}`} className="botao botao--secundario">
          Ver detalhes
        </Link>
      )}
    </article>
  );
}

// PBI-05 (+ PBI-08: organizador responsável e apoio local)
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
        <dt>Responsável</dt>
        <dd>{acao.responsavel}</dd>
        {acao.apoioLocal && (
          <>
            <dt>Apoio</dt>
            <dd>{acao.apoioLocal}</dd>
          </>
        )}
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
      <Contador quantidade={acao.interessados} singular="voluntário confirmado" plural="voluntários confirmados" />
      {!detalhe && (
        <Link to={`/atividades/${acao.id}`} className="botao botao--secundario">
          Ver detalhes
        </Link>
      )}
    </article>
  );
}
