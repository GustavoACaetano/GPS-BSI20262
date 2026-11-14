const BASE = import.meta.env.VITE_API_URL || '/api';

// Erro da API; em validações (400) traz `campos` com uma mensagem por campo.
export class ErroApi extends Error {
  constructor(mensagem, status, campos) {
    super(mensagem);
    this.status = status;
    this.campos = campos || {};
  }
}

// PBI-11: token da sessão do organizador e aviso de sessão expirada (definidos pelo ProvedorSessao).
let tokenSessao = null;
let aoExpirarSessao = () => {};

export function configurarSessao({ token, aoExpirar }) {
  tokenSessao = token || null;
  if (aoExpirar) aoExpirarSessao = aoExpirar;
}

async function requisitar(...argumentosFetch) {
  const resposta = await fetch(...argumentosFetch);
  const corpo = resposta.status === 204 ? {} : await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    if (resposta.status === 401 && tokenSessao) aoExpirarSessao();
    throw new ErroApi(
      corpo.erro || `Falha ao carregar dados (${resposta.status}).`,
      resposta.status,
      corpo.campos,
    );
  }
  return corpo;
}

const cabecalhoAuth = () => (tokenSessao ? { Authorization: `Bearer ${tokenSessao}` } : {});

function get(caminho, parametros = {}, { autenticado = false } = {}) {
  const busca = new URLSearchParams(
    Object.entries(parametros).filter(([, valor]) => valor !== undefined && valor !== ''),
  );
  const url = `${BASE}${caminho}${busca.toString() ? `?${busca}` : ''}`;
  return autenticado ? requisitar(url, { headers: cabecalhoAuth() }) : requisitar(url);
}

function enviar(metodo, caminho, corpo) {
  return requisitar(`${BASE}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...cabecalhoAuth() },
    body: JSON.stringify(corpo ?? {}),
  });
}

export const api = {
  listarPraias: (parametros) => get('/praias', parametros),
  obterPraia: (id) => get(`/praias/${id}`),
  obterBalneabilidade: (id) => get(`/praias/${id}/balneabilidade`),
  listarAtividades: (tipo, parametros = {}) => get('/atividades', { tipo, ...parametros }),
  obterAtividade: (id) => get(`/atividades/${id}`),
  // PBI-06 (exige login)
  cadastrarAula: (aula) => enviar('POST', '/atividades/aulas', aula),
  editarAula: (id, aula) => enviar('PUT', `/atividades/aulas/${id}`, aula),
  listarMinhasAtividades: () => get('/atividades/minhas', {}, { autenticado: true }),
  obterMinhaAtividade: (id) => get(`/atividades/minhas/${id}`, {}, { autenticado: true }),
  // PBI-11
  criarConta: (dados) => enviar('POST', '/auth/cadastro', dados),
  entrar: (email, senha) => enviar('POST', '/auth/login', { email, senha }),
  sair: () => enviar('POST', '/auth/logout'),
  obterPerfil: () => get('/auth/perfil', {}, { autenticado: true }),
  atualizarPerfil: (dados) => enviar('PUT', '/auth/perfil', dados),
  trocarSenha: (senhaAtual, novaSenha) => enviar('PUT', '/auth/senha', { senhaAtual, novaSenha }),
  recuperarSenha: (email) => enviar('POST', '/auth/recuperar-senha', { email }),
  redefinirSenha: (token, novaSenha) => enviar('POST', '/auth/redefinir-senha', { token, novaSenha }),
};
