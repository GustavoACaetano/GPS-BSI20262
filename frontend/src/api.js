const BASE = import.meta.env.VITE_API_URL || '/api';

async function get(caminho, parametros = {}) {
  const busca = new URLSearchParams(
    Object.entries(parametros).filter(([, valor]) => valor !== undefined && valor !== ''),
  );
  const url = `${BASE}${caminho}${busca.toString() ? `?${busca}` : ''}`;
  const resposta = await fetch(url);
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(corpo.erro || `Falha ao carregar dados (${resposta.status}).`);
  }
  return corpo;
}

export const api = {
  listarPraias: (parametros) => get('/praias', parametros),
  obterPraia: (id) => get(`/praias/${id}`),
  obterBalneabilidade: (id) => get(`/praias/${id}/balneabilidade`),
  listarAtividades: (tipo, parametros = {}) => get('/atividades', { tipo, ...parametros }),
  obterAtividade: (id) => get(`/atividades/${id}`),
};
