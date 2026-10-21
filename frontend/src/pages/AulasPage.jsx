import { useState } from 'react';
import { AulaCard } from '../components/AtividadeCards.jsx';
import { Carregando, Erro, Vazio } from '../components/Estado.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';

// PBI-03 Consultar Aulas Esportivas
export default function AulasPage() {
  const [ordenar, setOrdenar] = useState('modalidade');
  const { dados, erro, carregando } = useDados(
    () => api.listarAtividades('AULA', { ordenar }),
    [ordenar],
  );

  return (
    <>
      <div className="titulo-pagina">
        <h1>Aulas</h1>
        <p>Surf, futevôlei, vôlei, SUP e mais — com dias, horários e instrutores.</p>
      </div>

      <div className="filtros">
        <label className="campo-inline">
          Ordenar por
          <select value={ordenar} onChange={(e) => setOrdenar(e.target.value)}>
            <option value="modalidade">Modalidade (A–Z)</option>
            <option value="praia">Praia (A–Z)</option>
          </select>
        </label>
      </div>

      {erro && <Erro erro={erro} />}
      {carregando && !dados && <Carregando />}
      {dados && dados.dados.length === 0 && <Vazio>Nenhuma aula cadastrada.</Vazio>}
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
