export function Carregando() {
  return <p className="estado" role="status">Carregando…</p>;
}

export function Erro({ erro }) {
  return (
    <p className="estado estado--erro" role="alert">
      {erro.message}
    </p>
  );
}

export function Vazio({ children }) {
  return <p className="estado">{children}</p>;
}
