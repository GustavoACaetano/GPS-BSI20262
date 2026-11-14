import { mock } from 'node:test';
import { pool } from '../src/db.js';
import { app } from '../src/app.js';

// Sobe a API em uma porta livre e substitui pool.query por um mock,
// para que os testes não dependam de um PostgreSQL rodando.
export async function iniciarServidor() {
  const servidor = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = servidor.address();

  const requisitar = async (metodo, caminho, corpo, cabecalhos = {}) => {
    const resposta = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: metodo,
      headers: corpo === undefined ? cabecalhos : { 'Content-Type': 'application/json', ...cabecalhos },
      body: corpo === undefined ? undefined : typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
    });
    return { status: resposta.status, corpo: await resposta.json() };
  };

  return {
    get: (caminho) => requisitar('GET', caminho),
    post: (caminho, corpo, cabecalhos) => requisitar('POST', caminho, corpo, cabecalhos),
    put: (caminho, corpo, cabecalhos) => requisitar('PUT', caminho, corpo, cabecalhos),
    patch: (caminho, corpo, cabecalhos) => requisitar('PATCH', caminho, corpo, cabecalhos),
    fechar: () => new Promise((resolve) => servidor.close(resolve)),
  };
}

// Cada chamada a query() consome a próxima resposta da fila.
export function mockarBanco(...respostas) {
  const fila = [...respostas];
  return mock.method(pool, 'query', async () => {
    const proxima = fila.shift();
    if (proxima instanceof Error) throw proxima;
    return proxima ?? { rows: [], rowCount: 0 };
  });
}

export const linhas = (rows) => ({ rows, rowCount: rows.length });
