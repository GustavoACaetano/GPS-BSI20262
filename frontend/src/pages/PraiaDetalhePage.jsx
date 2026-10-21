import { Link, useParams } from 'react-router-dom';
import { FotoPraia } from '../components/BeachCard.jsx';
import { PainelBalneabilidade, TagBalneabilidade } from '../components/Balneabilidade.jsx';
import { Carregando, Erro } from '../components/Estado.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';
import { formatarData } from '../formatacao.js';

const TIPOS = [
  { tipo: 'AULA', rotulo: 'Aulas' },
  { tipo: 'EVENTO', rotulo: 'Eventos esportivos' },
  { tipo: 'ACAO_COMUNITARIA', rotulo: 'Ações comunitárias' },
];

async function carregarPraia(id) {
  const [praia, balneabilidade, ...atividades] = await Promise.all([
    api.obterPraia(id),
    api.obterBalneabilidade(id),
    ...TIPOS.map(({ tipo }) => api.listarAtividades(tipo, { praia: id })),
  ]);
  return { praia, balneabilidade, atividades: atividades.map((r) => r.dados) };
}

// Página individual da praia (PBI-01) com balneabilidade (PBI-02)
export default function PraiaDetalhePage() {
  const { id } = useParams();
  const { dados, erro, carregando } = useDados(() => carregarPraia(id), [id]);

  if (erro) return <Erro erro={erro} />;
  if (carregando || !dados) return <Carregando />;

  const { praia, balneabilidade, atividades } = dados;
  const mapa = `https://www.google.com/maps/search/?api=1&query=${praia.latitude},${praia.longitude}`;

  return (
    <article className="detalhe">
      <Link to="/praias" className="voltar">← Todas as praias</Link>
      <FotoPraia praia={praia} grande />
      <h1>{praia.nome}</h1>
      <p className="card__subtitulo">{praia.municipio}</p>
      {praia.descricao && <p>{praia.descricao}</p>}
      <a className="botao botao--secundario" href={mapa} target="_blank" rel="noreferrer">
        Ver localização no mapa
      </a>

      <PainelBalneabilidade boletim={balneabilidade.atual} />

      {balneabilidade.historico.length > 1 && (
        <section>
          <h2>Boletins anteriores</h2>
          <ul className="historico">
            {balneabilidade.historico.slice(1).map((b) => (
              <li key={b.id}>
                <span>{formatarData(b.dataColeta)} · {b.fonte}</span>
                <TagBalneabilidade boletim={{ ...b, pendenteAtualizacao: false }} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {TIPOS.map(({ tipo, rotulo }, i) =>
        atividades[i].length > 0 ? (
          <section key={tipo}>
            <h2>{rotulo} nesta praia</h2>
            <ul className="lista-simples">
              {atividades[i].map((a) => (
                <li key={a.id}>
                  <Link to={`/atividades/${a.id}`}>{a.titulo}</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </article>
  );
}
