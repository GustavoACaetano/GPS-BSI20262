import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import AvaliacaoGoBeach from './AvaliacaoGoBeach.jsx';

// PBI-14: botão "Avaliar o GoBeach" no rodapé de todas as páginas.
export default function RodapeAvaliacao() {
  const [aberto, setAberto] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="rodape-avaliacao">
      <button
        type="button"
        className="botao botao--secundario"
        aria-expanded={aberto}
        aria-controls="painel-avaliacao"
        onClick={() => setAberto((a) => !a)}
      >
        {aberto ? 'Fechar avaliação' : '★ Avaliar o GoBeach'}
      </button>
      {aberto && (
        <div id="painel-avaliacao" className="painel painel--neutro rodape-avaliacao__painel">
          <AvaliacaoGoBeach origem={pathname} />
        </div>
      )}
    </div>
  );
}
