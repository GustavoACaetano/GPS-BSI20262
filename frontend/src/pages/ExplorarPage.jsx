import { Link, useSearchParams } from 'react-router-dom';
import { AcaoCard, AulaCard, EventoCard } from '../components/AtividadeCards.jsx';
import { TagBalneabilidade } from '../components/Balneabilidade.jsx';
import { Erro } from '../components/Estado.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';
import { calcularPeriodo, hojeLocal, PERIODOS } from '../formatacao.js';

// PBI-09 Filtrar Conteúdo por Categoria e Praia.
// Filtros combinados com atualização dinâmica: cada mudança refaz a busca, sem botão de "buscar".
// Os filtros ficam na URL, para compartilhar o link e funcionar com o "voltar" do navegador.

export const CATEGORIAS = [
  { tipo: 'AULA', rotulo: 'Aulas', titulo: 'Aulas', Card: ({ item }) => <AulaCard aula={item} /> },
  { tipo: 'EVENTO', rotulo: 'Eventos', titulo: 'Eventos esportivos', Card: ({ item }) => <EventoCard evento={item} /> },
  { tipo: 'ACAO_COMUNITARIA', rotulo: 'Ações', titulo: 'Ações comunitárias', Card: ({ item }) => <AcaoCard acao={item} /> },
];

const MUNICIPIOS = ['Vitória', 'Vila Velha', 'Serra', 'Guarapari'];

// Lê os filtros da URL.
export function lerFiltros(parametros) {
  const categorias = (parametros.get('categorias') || '')
    .split(',')
    .filter((c) => CATEGORIAS.some((cat) => cat.tipo === c));
  return {
    categorias,
    municipio: parametros.get('municipio') || '',
    praia: parametros.get('praia') || '',
    modalidade: parametros.get('modalidade') || '',
    quando: parametros.get('quando') || '',
    de: parametros.get('de') || '',
    ate: parametros.get('ate') || '',
    propria: parametros.get('propria') === 'true',
  };
}

// Filtros da tela -> parâmetros da API (datas calculadas a partir do período escolhido).
export function paraConsulta(filtros, hoje = hojeLocal()) {
  const periodo = calcularPeriodo(filtros.quando, hoje, filtros);
  return {
    categorias: filtros.categorias.join(','),
    municipio: filtros.municipio,
    praia: filtros.praia,
    modalidade: filtros.modalidade,
    de: periodo?.de,
    ate: periodo?.ate,
    propria: filtros.propria ? 'true' : undefined,
  };
}

const temFiltro = (f) =>
  f.categorias.length > 0 || f.municipio || f.praia || f.modalidade || f.quando || f.propria;

export default function ExplorarPage() {
  const [parametros, setParametros] = useSearchParams();
  const filtros = lerFiltros(parametros);
  const consulta = paraConsulta(filtros);
  const chave = JSON.stringify(consulta);

  const { dados, erro, carregando } = useDados(() => api.explorar(consulta), [chave]);
  const { dados: praias } = useDados(
    () => api.listarPraias({ municipio: filtros.municipio, limite: 100 }),
    [filtros.municipio],
  );
  const { dados: modalidades } = useDados(() => api.listarModalidades(), []);

  // Atualiza a URL; valores vazios saem da query string.
  const alterar = (mudancas) => {
    const novos = { ...filtros, ...mudancas };
    const query = {};
    if (novos.categorias.length) query.categorias = novos.categorias.join(',');
    for (const campo of ['municipio', 'praia', 'modalidade', 'quando']) {
      if (novos[campo]) query[campo] = novos[campo];
    }
    if (novos.quando === 'personalizado') {
      if (novos.de) query.de = novos.de;
      if (novos.ate) query.ate = novos.ate;
    }
    if (novos.propria) query.propria = 'true';
    setParametros(query, { replace: true });
  };

  const alternarCategoria = (tipo) =>
    alterar({
      categorias: filtros.categorias.includes(tipo)
        ? filtros.categorias.filter((c) => c !== tipo)
        : [...filtros.categorias, tipo],
    });

  // Trocar de município limpa a praia, que pode não pertencer a ele.
  const trocarMunicipio = (municipio) => alterar({ municipio, praia: '' });

  const praiaSelecionada = praias?.dados.find((p) => String(p.id) === filtros.praia);
  const visiveis = CATEGORIAS.filter(
    (c) => filtros.categorias.length === 0 || filtros.categorias.includes(c.tipo),
  );
  const periodoIncompleto = filtros.quando === 'personalizado' && !consulta.de;

  return (
    <>
      <div className="titulo-pagina">
        <h1>Explorar</h1>
        <p>Combine categoria, praia, modalidade e data para encontrar o que fazer na orla.</p>
      </div>

      <section className="painel painel--neutro explorar__filtros" aria-label="Filtros">
        <div className="campo">
          <span className="campo__rotulo" id="categorias-rotulo">Categorias</span>
          <div className="dias" role="group" aria-labelledby="categorias-rotulo">
            {CATEGORIAS.map(({ tipo, rotulo }) => (
              <label key={tipo} className="dia">
                <input
                  type="checkbox"
                  checked={filtros.categorias.includes(tipo)}
                  onChange={() => alternarCategoria(tipo)}
                />
                <span>{rotulo}</span>
              </label>
            ))}
          </div>
          <small className="campo__dica">Nenhuma marcada = todas as categorias.</small>
        </div>

        <div className="explorar__grade">
          <div className="campo">
            <label htmlFor="f-municipio">Município</label>
            <select id="f-municipio" value={filtros.municipio} onChange={(e) => trocarMunicipio(e.target.value)}>
              <option value="">Todos os municípios</option>
              {MUNICIPIOS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="f-praia">Praia</label>
            <select id="f-praia" value={filtros.praia} onChange={(e) => alterar({ praia: e.target.value })}>
              <option value="">Todas as praias</option>
              {praias?.dados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}{filtros.municipio ? '' : ` · ${p.municipio}`}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="f-modalidade">Modalidade</label>
            <select id="f-modalidade" value={filtros.modalidade} onChange={(e) => alterar({ modalidade: e.target.value })}>
              <option value="">Todas as modalidades</option>
              {modalidades?.dados.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="f-quando">Quando</label>
            <select id="f-quando" value={filtros.quando} onChange={(e) => alterar({ quando: e.target.value })}>
              {PERIODOS.map((p) => (
                <option key={p.valor} value={p.valor}>{p.rotulo}</option>
              ))}
            </select>
          </div>
          {filtros.quando === 'personalizado' && (
            <>
              <div className="campo">
                <label htmlFor="f-de">De</label>
                <input id="f-de" type="date" value={filtros.de} onChange={(e) => alterar({ de: e.target.value })} />
              </div>
              <div className="campo">
                <label htmlFor="f-ate">Até</label>
                <input id="f-ate" type="date" min={filtros.de || undefined} value={filtros.ate} onChange={(e) => alterar({ ate: e.target.value })} />
              </div>
            </>
          )}
        </div>

        <label className="opcao">
          <input type="checkbox" checked={filtros.propria} onChange={(e) => alterar({ propria: e.target.checked })} />
          Só praias próprias para banho (boletim em dia)
        </label>

        {filtros.modalidade && (
          <p className="campo__dica">Ações comunitárias não têm modalidade e ficam de fora com este filtro.</p>
        )}
        {periodoIncompleto && <p className="campo__dica">Escolha as duas datas para filtrar pelo período.</p>}
        {temFiltro(filtros) && (
          <button type="button" className="botao botao--secundario explorar__limpar" onClick={() => setParametros({}, { replace: true })}>
            Limpar filtros
          </button>
        )}
      </section>

      {praiaSelecionada && (
        <section className="painel painel--neutro explorar__praia">
          <div>
            <strong>{praiaSelecionada.nome}</strong> · {praiaSelecionada.municipio}
          </div>
          <TagBalneabilidade boletim={praiaSelecionada.balneabilidade} />
          <Link to={`/praias/${praiaSelecionada.id}`}>Ver praia e boletins</Link>
        </section>
      )}

      <p className="explorar__resumo" role="status" aria-live="polite">
        {carregando
          ? 'Atualizando resultados…'
          : dados && `${dados.total} ${dados.total === 1 ? 'resultado' : 'resultados'}`}
      </p>

      {erro && <Erro erro={erro} />}

      {dados && dados.total === 0 && (
        <div className="estado">
          <p>Nenhuma atividade encontrada com esses filtros.</p>
          <button type="button" className="botao botao--secundario" onClick={() => setParametros({}, { replace: true })}>
            Limpar filtros
          </button>
        </div>
      )}

      {dados && dados.total > 0 && (
        <div className={carregando ? 'explorar__resultados explorar__resultados--atualizando' : 'explorar__resultados'}>
          {visiveis.map(({ tipo, titulo, Card }) => {
            const itens = dados.dados.filter((a) => a.tipo === tipo);
            if (itens.length === 0) return null;
            return (
              <section key={tipo} aria-labelledby={`secao-${tipo}`}>
                <h2 id={`secao-${tipo}`}>
                  {titulo} <span className="contagem">{itens.length}</span>
                </h2>
                <div className="grade">
                  {itens.map((item) => (
                    <Card key={item.id} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
