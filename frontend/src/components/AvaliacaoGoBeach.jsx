import { useState } from 'react';
import { api } from '../api.js';

// PBI-14: avaliação da plataforma (1 a 5 estrelas) com sugestões opcionais.
// Anônima; o navegador lembra que a pessoa já avaliou para não pedir de novo.

export const DESCRICOES = ['', 'Nada útil', 'Pouco útil', 'Mais ou menos', 'Útil', 'Muito útil'];

const CHAVE = 'gobeach:avaliou';
export function jaAvaliou() {
  try {
    return Boolean(localStorage.getItem(CHAVE));
  } catch {
    return false;
  }
}
function lembrarAvaliacao() {
  try {
    localStorage.setItem(CHAVE, new Date().toISOString());
  } catch {
    // Sem armazenamento: o convite pode reaparecer, sem prejuízo.
  }
}

// Estrelas como botões de opção nativos (teclado: setas mudam a nota).
export function Estrelas({ nota, aoEscolher, erro }) {
  const [destaque, setDestaque] = useState(0);
  const mostrada = destaque || nota;
  return (
    <fieldset className="estrelas-campo">
      <legend>O GoBeach foi útil para encontrar atividades nas praias?</legend>
      <div className="estrelas" onMouseLeave={() => setDestaque(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`estrela${n <= mostrada ? ' estrela--ativa' : ''}`} onMouseEnter={() => setDestaque(n)}>
            <input
              type="radio"
              name="nota"
              value={n}
              checked={nota === n}
              onChange={() => aoEscolher(n)}
              aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}: ${DESCRICOES[n]}`}
            />
            <span aria-hidden="true">★</span>
          </label>
        ))}
        <span className="estrelas__descricao" aria-hidden="true">{DESCRICOES[mostrada]}</span>
      </div>
      {erro && <small className="campo__erro">{erro}</small>}
    </fieldset>
  );
}

export default function AvaliacaoGoBeach({ origem, convite = false }) {
  const [avaliouAntes] = useState(jaAvaliou);
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [agradecimento, setAgradecimento] = useState(null);

  // O convite (ex.: após a inscrição) some para quem já avaliou.
  if (avaliouAntes && convite) return null;

  if (agradecimento) {
    return (
      <div className="avaliacao avaliacao--enviada" role="status">
        <p><strong>{agradecimento}</strong></p>
      </div>
    );
  }

  if (avaliouAntes) {
    return (
      <div className="avaliacao" role="status">
        <p>Você já avaliou o GoBeach neste navegador. Obrigado pela contribuição!</p>
      </div>
    );
  }

  const enviar = async (evento) => {
    evento.preventDefault();
    setErroGeral(null);
    if (!nota) {
      setErros({ nota: 'Escolha de 1 a 5 estrelas.' });
      return;
    }
    setEnviando(true);
    try {
      const resposta = await api.avaliar({ nota, comentario: comentario.trim(), pagina: origem });
      lembrarAvaliacao();
      setAgradecimento(resposta.mensagem);
    } catch (erro) {
      setErros(erro.campos || {});
      setErroGeral(erro.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="avaliacao" onSubmit={enviar} noValidate>
      {convite && <p className="avaliacao__convite">Gostou da experiência? Conte para a gente.</p>}
      <Estrelas
        nota={nota}
        erro={erros.nota}
        aoEscolher={(n) => {
          setNota(n);
          setErros((atual) => ({ ...atual, nota: undefined }));
        }}
      />
      <div className={`campo${erros.comentario ? ' campo--erro' : ''}`}>
        <label htmlFor={`avaliacao-comentario-${origem}`}>Sugestões de melhoria (opcional)</label>
        <textarea
          id={`avaliacao-comentario-${origem}`}
          rows={2}
          maxLength={1000}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="O que faltou ou poderia ser melhor?"
        />
        {erros.comentario && <small className="campo__erro">{erros.comentario}</small>}
      </div>
      {erroGeral && <p className="estado--erro formulario__erro" role="alert">{erroGeral}</p>}
      <button type="submit" className="botao" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar avaliação'}
      </button>
      <p className="texto-suave avaliacao__privacidade">A avaliação é anônima.</p>
    </form>
  );
}
