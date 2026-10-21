// Selo de "Adiado" ou "Cancelado" exibido quando o organizador altera o status (PBI-04).
export default function SeloStatus({ status }) {
  if (status === 'ADIADO') return <span className="selo selo--adiado">Adiado</span>;
  if (status === 'CANCELADO') return <span className="selo selo--cancelado">Cancelado</span>;
  return null;
}
