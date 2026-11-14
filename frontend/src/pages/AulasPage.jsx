import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AulaCard } from '../components/AtividadeCards.jsx';
import { Carregando, Erro, Vazio } from '../components/Estado.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';

// PBI-03 Consultar Aulas Esportivas (+ PBI-06: acesso ao cadastro e filtro por praia)
export default function AulasPage() {
  const [ordenar, setOrdenar] = useState('modalidade');
  const [praia, setPraia] = useState('');
  const { dados: praias } = useDados(() => api.listarPraias({ limite: 100 }), []);
  const { dados, erro, carregando } = useDados(
    () => api.listarAtividades('AULA', { ordenar, praia }),
    [ordenar, praia],
  );

  return (
    <>
      <div className="titulo-pagina titulo-pagina--acao">
        <div>
          <h1>Aulas</h1>
          <p>Surf, futevôlei, vôlei, SUP e mais — com dias, horários e instrutores.</p>
        </div>
        <Link to="/aulas/nova" className="botao">
          + Cadastrar aula
        </Link>
      </div>

      <div className="filtros">
        <label className="campo-inline">
          Ordenar por
          <select value={ordenar} onChange={(e) => setOrdenar(e.target.value)}>
            <option value="modalidade">Modalidade (A–Z)</option>
            <option value="praia">Praia (A–Z)</option>
          </select>
        </label>
        <label className="campo-inline">
          Praia
          <select value={praia} onChange={(e) => setPraia(e.target.value)}>
            <option value="">Todas as praias</option>
            {praias?.dados.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · {p.municipio}
              </option>
            ))}
          </select>
        </label>
      </div>

      {erro && <Erro erro={erro} />}
      {carregando && !dados && <Carregando />}
      {dados && dados.dados.length === 0 && (
        <Vazio>{praia ? 'Nenhuma aula cadastrada nesta praia.' : 'Nenhuma aula cadastrada.'}</Vazio>
      )}
      {dados && dados.dados.length > 0 && (
        <div className="grade">
          {dados.dados.map((aula) => (
            <AulaCard key={aula.id} aula={aula} />
          ))}
        </div>
      )}
    </>
  );
}
