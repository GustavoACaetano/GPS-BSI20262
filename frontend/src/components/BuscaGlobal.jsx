import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// PBI-13: campo de busca no topo de todas as páginas; leva ao Explorar com a palavra-chave.
export default function BuscaGlobal() {
  const navegar = useNavigate();
  const local = useLocation();
  const [texto, setTexto] = useState('');

  // No Explorar, o campo da própria página assume; aqui o topo só limpa depois de buscar.
  useEffect(() => {
    if (local.pathname !== '/explorar') setTexto('');
  }, [local.pathname]);

  const buscar = (evento) => {
    evento.preventDefault();
    const termo = texto.trim();
    if (!termo) return;
    navegar(`/explorar?busca=${encodeURIComponent(termo)}`);
    setTexto('');
  };

  return (
    <form className="busca-global" role="search" onSubmit={buscar}>
      <label htmlFor="busca-global" className="visualmente-oculto">
        Buscar no GoBeach
      </label>
      <input
        id="busca-global"
        type="search"
        placeholder="Buscar: surf, Camburi…"
        maxLength={100}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <button type="submit" aria-label="Buscar">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
    </form>
  );
}
