import { Link } from 'react-router-dom';
import { TagBalneabilidade } from './Balneabilidade.jsx';

const CORES_MUNICIPIO = {
  Vitória: ['#0b6e99', '#38b2d8'],
  'Vila Velha': ['#0f766e', '#2dd4bf'],
  Serra: ['#1d4ed8', '#60a5fa'],
  Guarapari: ['#b45309', '#fbbf24'],
};

export function FotoPraia({ praia, grande = false }) {
  const [de, para] = CORES_MUNICIPIO[praia.municipio] || ['#0b6e99', '#38b2d8'];
  if (praia.fotoUrl) {
    return <img className={`foto${grande ? ' foto--grande' : ''}`} src={praia.fotoUrl} alt={praia.nome} />;
  }
  return (
    <div
      className={`foto foto--placeholder${grande ? ' foto--grande' : ''}`}
      style={{ background: `linear-gradient(135deg, ${de}, ${para})` }}
      role="img"
      aria-label={`Ilustração da praia ${praia.nome}`}
    >
      <svg viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 20 Q 25 5 50 20 T 100 20 T 150 20 T 200 20 V40 H0 Z" fill="rgba(255,255,255,0.35)" />
        <path d="M0 28 Q 25 16 50 28 T 100 28 T 150 28 T 200 28 V40 H0 Z" fill="#f5e6c8" />
      </svg>
    </div>
  );
}

// PBI-01: card clicável que leva à página individual da praia.
export default function BeachCard({ praia }) {
  return (
    <Link to={`/praias/${praia.id}`} className="card card--link">
      <FotoPraia praia={praia} />
      <div className="card__corpo">
        <h3 className="card__titulo">{praia.nome}</h3>
        <p className="card__subtitulo">{praia.municipio}</p>
        <TagBalneabilidade boletim={praia.balneabilidade} />
      </div>
    </Link>
  );
}
