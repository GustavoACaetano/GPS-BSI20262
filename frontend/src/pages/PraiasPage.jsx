import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BeachCard from '../components/BeachCard.jsx';
import MapaPraias from '../components/MapaPraias.jsx';
import { Carregando, Erro, Vazio } from '../components/Estado.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';

const MUNICIPIOS = ['Vitória', 'Vila Velha', 'Serra', 'Guarapari'];

// PBI-01 Consultar Praias da Grande Vitória
export default function PraiasPage() {
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [municipio, setMunicipio] = useState('');
  // A visualização fica na URL (?visao=lista) para sobreviver ao "voltar" do navegador.
  const [parametros, setParametros] = useSearchParams();
  const visao = parametros.get('visao') === 'lista' ? 'lista' : 'mapa';
  const trocarVisao = (nova) =>
    setParametros(nova === 'mapa' ? {} : { visao: nova }, { replace: true });

  useEffect(() => {
    const timer = setTimeout(() => setBusca(texto.trim()), 300);
    return () => clearTimeout(timer);
  }, [texto]);

  const { dados, erro, carregando } = useDados(
    () => api.listarPraias({ busca, municipio }),
    [busca, municipio],
  );

  return (
    <>
      <div className="titulo-pagina">
        <h1>Praias</h1>
        <p>Escolha sua praia e confira a balneabilidade antes de entrar na água.</p>
      </div>

      <div className="filtros">
        <input
          type="search"
          placeholder="Buscar por praia ou município"
          aria-label="Buscar praia"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <select
          aria-label="Filtrar por município"
          value={municipio}
          onChange={(e) => setMunicipio(e.target.value)}
        >
          <option value="">Todos os municípios</option>
          {MUNICIPIOS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <div className="alternador" role="group" aria-label="Visualização">
          {['mapa', 'lista'].map((opcao) => (
            <button
              key={opcao}
              type="button"
              className={visao === opcao ? 'ativo' : ''}
              aria-pressed={visao === opcao}
              onClick={() => trocarVisao(opcao)}
            >
              {opcao === 'mapa' ? 'Mapa' : 'Lista'}
            </button>
          ))}
        </div>
      </div>

      {erro && <Erro erro={erro} />}
      {carregando && !dados && <Carregando />}
      {dados && dados.dados.length === 0 && <Vazio>Nenhuma praia encontrada</Vazio>}
      {dados && dados.dados.length > 0 && visao === 'mapa' && <MapaPraias praias={dados.dados} />}
      {dados && dados.dados.length > 0 && visao === 'lista' && (
        <div className="grade">
          {dados.dados.map((praia) => (
            <BeachCard key={praia.id} praia={praia} />
          ))}
        </div>
      )}
    </>
  );
}
