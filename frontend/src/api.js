const BASE = import.meta.env.VITE_API_URL || '/api';

// Erro da API; em validações (400) traz `campos` com uma mensagem por campo.
export class ErroApi extends Error {
  constructor(mensagem, status, campos) {
    super(mensagem);
    this.status = status;
    this.campos = campos || {};
  }
}

async function requisitar(...argumentosFetch) {
  const resposta = await fetch(...argumentosFetch);
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new ErroApi(
      corpo.erro || `Falha ao carregar dados (${resposta.status}).`,
      resposta.status,
      corpo.campos,
    );
  }
  return corpo;
}

function get(caminho, parametros = {}) {
  const busca = new URLSearchParams(
    Object.entries(parametros).filter(([, valor]) => valor !== undefined && valor !== ''),
  );
  return requisitar(`${BASE}${caminho}${busca.toString() ? `?${busca}` : ''}`);
}

function enviar(metodo, caminho, corpo, cabecalhos = {}) {
  return requisitar(`${BASE}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...cabecalhos },
    body: JSON.stringify(corpo),
  });
}

export const api = {
  listarPraias: (parametros) => get('/praias', parametros),
  obterPraia: (id) => get(`/praias/${id}`),
  obterBalneabilidade: (id) => get(`/praias/${id}/balneabilidade`),
  listarAtividades: (tipo, parametros = {}) => get('/atividades', { tipo, ...parametros }),
  obterAtividade: (id) => get(`/atividades/${id}`),
  // PBI-06
  cadastrarAula: (aula) => enviar('POST', '/atividades/aulas', aula),
  editarAula: (id, aula, codigoEdicao) =>
    enviar('PUT', `/atividades/aulas/${id}`, aula, { 'X-Codigo-Edicao': codigoEdicao }),
};
