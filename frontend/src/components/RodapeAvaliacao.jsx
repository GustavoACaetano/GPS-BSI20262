import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AvaliacaoGoBeach from './AvaliacaoGoBeach.jsx';

// PBI-14: link "Avaliar o GoBeach" no rodapé, que abre a avaliação num modal.
// O <dialog> nativo prende o foco na janela, fecha com Esc e devolve o foco ao link.
export default function RodapeAvaliacao() {
  const [aberto, setAberto] = useState(false);
  const dialogo = useRef(null);
  const { pathname } = useLocation();

  // Abre direto no clique (não depende do estado já ter registrado um fechamento feito pelo navegador).
  const abrir = () => {
    if (dialogo.current && !dialogo.current.open) dialogo.current.showModal();
    setAberto(true);
  };

  useEffect(() => {
    if (!aberto && dialogo.current?.open) dialogo.current.close();
  }, [aberto]);

  return (
    <>
      <button type="button" className="link-rodape" aria-haspopup="dialog" onClick={abrir}>
        ★ Avaliar o GoBeach
      </button>
      <dialog
        ref={dialogo}
        className="modal"
        aria-labelledby="modal-avaliacao-titulo"
        // Esc ou dialog.close() disparam "close": mantém o estado em sintonia.
        onClose={() => setAberto(false)}
        // Clique no fundo escurecido (fora da caixa) fecha o modal.
        onClick={(e) => {
          if (e.target === e.currentTarget) setAberto(false);
        }}
      >
        <div className="modal__caixa">
          <div className="modal__cabecalho">
            <h2 id="modal-avaliacao-titulo">Avaliar o GoBeach</h2>
            <button type="button" className="modal__fechar" aria-label="Fechar" onClick={() => setAberto(false)}>
              ✕
            </button>
          </div>
          {/* Montado só enquanto aberto: ao reabrir, mostra o estado atualizado (ex.: "já avaliou"). */}
          {aberto && <AvaliacaoGoBeach origem={pathname} />}
        </div>
      </dialog>
    </>
  );
}
