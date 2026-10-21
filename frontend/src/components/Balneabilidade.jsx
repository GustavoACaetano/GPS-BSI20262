import { formatarData, formatarDataHora } from '../formatacao.js';

const ROTULOS = { PROPRIA: 'Própria para banho', IMPROPRIA: 'Imprópria para banho' };

// PBI-02: tag colorida (verde/vermelho) + alerta amarelo para boletins com mais de 7 dias.
// Sem boletim válido (data de coleta e fonte), nenhum status é exibido.
export function TagBalneabilidade({ boletim }) {
  if (!boletim) {
    return <span className="tag tag--neutra">Sem boletim disponível</span>;
  }
  const classe = boletim.status === 'PROPRIA' ? 'tag--propria' : 'tag--impropria';
  return (
    <span className="tags">
      <span className={`tag ${classe}`}>{ROTULOS[boletim.status]}</span>
      {boletim.pendenteAtualizacao && (
        <span className="tag tag--alerta">Pendente de atualização</span>
      )}
    </span>
  );
}

export function PainelBalneabilidade({ boletim }) {
  return (
    <section className={`painel painel--${boletim ? boletim.status.toLowerCase() : 'neutro'}`}>
      <h2>Balneabilidade</h2>
      <TagBalneabilidade boletim={boletim} />
      {boletim ? (
        <dl className="detalhes">
          <dt>Boletim oficial</dt>
          <dd>{formatarDataHora(boletim.dataBoletim)}</dd>
          <dt>Data da coleta</dt>
          <dd>{formatarData(boletim.dataColeta)}</dd>
          <dt>Órgão emissor</dt>
          <dd>{boletim.fonte}</dd>
        </dl>
      ) : (
        <p className="texto-suave">
          Ainda não há boletim oficial com data de coleta para esta praia.
        </p>
      )}
      {boletim?.pendenteAtualizacao && (
        <p className="aviso">
          O último boletim tem {boletim.diasDesdeBoletim} dias. Consulte o órgão emissor antes de
          entrar na água.
        </p>
      )}
    </section>
  );
}
