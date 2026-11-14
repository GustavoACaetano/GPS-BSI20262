import { useEffect, useRef, useState } from 'react';
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
// PBI-13: busca por palavra-chave (parcial, sem diferenciar acentos), combinável com os filtros.

const ESPERA_DIGITACAO_MS = 350;

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
    busca: parametros.get('busca') || '',
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
    busca: filtros.busca.trim(),
    categorias: filtros.categorias.join(','),
    municipio: filtros.municipio,
    praia: filtros.praia,
    modalidade: filtros.modalidade,
    de: periodo?.de,
    ate: periodo?.ate,
    propria: filtros.propria ? 'true' : undefined,
  };
}

const temOutrosFiltros = (f) =>
  f.categorias.length > 0 || f.municipio || f.praia || f.modalidade || f.quando || f.propria;
const temFiltro = (f) => f.busca || temOutrosFiltros(f);

// Filtros -> query string da URL (valores vazios saem).
export function paraUrl(f) {
  const query = {};
  if (f.busca.trim()) query.busca = f.busca.trim();
  if (f.categorias.length) query.categorias = f.categorias.join(',');
  for (const campo of ['municipio', 'praia', 'modalidade', 'quando']) {
    if (f[campo]) query[campo] = f[campo];
  }
  if (f.quando === 'personalizado') {
    if (f.de) query.de = f.de;
    if (f.ate) query.ate = f.ate;
  }
  if (f.propria) query.propria = 'true';
  return query;
}

// PBI-13: sem resultados, mostra "Nenhum resultado" com sugestões.
function NenhumResultado({ busca, sugestoes, aoBuscar, aoRemoverFiltros, aoLimpar }) {
  return (
    <div className="estado nenhum-resultado" role="status">
      <p>
        <strong>Nenhum resultado</strong>
        {busca ? <> para "{busca}"</> : ' com esses filtros'}.
      </p>
      {sugestoes?.termos.length > 0 && (
        <p className="sugestoes">
          Você quis dizer:{' '}
          {sugestoes.termos.map((termo) => (
            <button key={termo} type="button" className="sugestao" onClick={() => aoBuscar(termo)}>
              {termo}
            </button>
          ))}
        </p>
      )}
      {sugestoes?.semFiltros > 0 && (
        <p>
          <button type="button" className="botao botao--secundario" onClick={aoRemoverFiltros}>
            Buscar "{busca}" sem os outros filtros ({sugestoes.semFiltros}{' '}
            {sugestoes.semFiltros === 1 ? 'resultado' : 'resultados'})
          </button>
        </p>
      )}
      {busca && !sugestoes?.termos.length && !sugestoes?.semFiltros && (
        <p className="texto-suave">Confira a grafia ou tente uma palavra mais curta, como "surf", "vôlei" ou o nome de uma praia.</p>
      )}
      <p>
        <button type="button" className="botao botao--secundario" onClick={aoLimpar}>
          Limpar busca e filtros
        </button>
      </p>
    </div>
  );
}

export function resumoResultados({ total, praias = [] }) {
  const partes = [`${total} ${total === 1 ? 'atividade' : 'atividades'}`];
  if (praias.length) partes.push(`${praias.length} ${praias.length === 1 ? 'praia' : 'praias'}`);
  return partes.join(' e ');
}

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

  // Atualiza a URL a partir do estado mais recente dela.
  const alterar = (mudancas) =>
    setParametros((atuais) => paraUrl({ ...lerFiltros(atuais), ...mudancas }), { replace: true });

  // PBI-13: o campo de busca atualiza a URL depois de uma pausa na digitação.
  const [texto, setTexto] = useState(filtros.busca);
  const ultimoEnviado = useRef(filtros.busca);
  useEffect(() => {
    // Busca alterada por fora (topo da página, sugestão, "limpar"): reflete no campo.
    if (filtros.busca !== ultimoEnviado.current) {
      ultimoEnviado.current = filtros.busca;
      setTexto(filtros.busca);
    }
  }, [filtros.busca]);
  useEffect(() => {
    if (texto.trim() === ultimoEnviado.current.trim()) return undefined;
    const timer = setTimeout(() => {
      ultimoEnviado.current = texto.trim();
      alterar({ busca: texto });
    }, ESPERA_DIGITACAO_MS);
    return () => clearTimeout(timer);
  }, [texto]);

  const buscarTermo = (termo) => alterar({ busca: termo });
  const limparTudo = () => setParametros({}, { replace: true });

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
        <p>Busque por palavra-chave e combine categoria, praia, modalidade e data para encontrar o que fazer na orla.</p>
      </div>

      <section className="painel painel--neutro explorar__filtros" aria-label="Filtros">
        <div className="campo">
          <label htmlFor="f-busca">Buscar</label>
          <input
            id="f-busca"
            type="search"
            value={texto}
            maxLength={100}
            placeholder='Ex.: "surf", "Camburi", "mutirão"'
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                ultimoEnviado.current = texto.trim();
                alterar({ busca: texto });
              }
            }}
          />
        </div>

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
          <button type="button" className="botao botao--secundario explorar__limpar" onClick={limparTudo}>
            Limpar busca e filtros
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
          : dados && resumoResultados(dados)}
      </p>

      {erro && <Erro erro={erro} />}

      {/* PBI-13: praias encontradas pela busca */}
      {dados?.praias?.length > 0 && (
        <section aria-labelledby="secao-praias" className="explorar__praias">
          <h2 id="secao-praias">
            Praias <span className="contagem">{dados.praias.length}</span>
          </h2>
          <ul className="lista-praias">
            {dados.praias.map((p) => (
              <li key={p.id}>
                <Link to={`/praias/${p.id}`}>
                  <strong>{p.nome}</strong> · {p.municipio}
                </Link>
                <TagBalneabilidade boletim={p.balneabilidade} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {dados && dados.total === 0 && !dados.praias?.length && (
        <NenhumResultado
          busca={consulta.busca}
          sugestoes={dados.sugestoes}
          aoBuscar={buscarTermo}
          aoRemoverFiltros={() => setParametros(paraUrl({ ...lerFiltros(new URLSearchParams()), busca: consulta.busca }), { replace: true })}
          aoLimpar={limparTudo}
        />
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
