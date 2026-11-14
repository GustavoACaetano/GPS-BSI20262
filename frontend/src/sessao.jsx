import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, configurarSessao } from './api.js';

// PBI-11: sessão do organizador. O token fica no localStorage para manter o login
// entre visitas; se o armazenamento falhar, o login vale só enquanto a aba estiver aberta.
const CHAVE = 'gobeach:sessao';

function lerSalva() {
  try {
    const salva = JSON.parse(localStorage.getItem(CHAVE));
    return salva?.token ? salva : null;
  } catch {
    return null;
  }
}

function gravar(sessao) {
  try {
    if (sessao) localStorage.setItem(CHAVE, JSON.stringify(sessao));
    else localStorage.removeItem(CHAVE);
  } catch {
    // Sem armazenamento disponível: segue só em memória.
  }
}

const ContextoSessao = createContext(null);

export function ProvedorSessao({ children }) {
  const [sessao, setSessao] = useState(() => {
    const salva = lerSalva();
    configurarSessao({ token: salva?.token });
    return salva;
  });

  const definir = useCallback((nova) => {
    configurarSessao({ token: nova?.token });
    gravar(nova);
    setSessao(nova);
  }, []);

  // Sessão expirada ou revogada (ex.: senha redefinida em outro aparelho).
  useEffect(() => {
    configurarSessao({ token: sessao?.token, aoExpirar: () => definir(null) });
  }, [sessao, definir]);

  // Confere a sessão salva e atualiza os dados do perfil ao abrir o site.
  useEffect(() => {
    if (!sessao?.token) return;
    api
      .obterPerfil()
      .then((organizador) => definir({ token: sessao.token, organizador }))
      .catch(() => {});
  }, []); // só na montagem

  const valor = useMemo(
    () => ({
      organizador: sessao?.organizador ?? null,
      logado: Boolean(sessao?.token),
      iniciar: ({ token, organizador }) => definir({ token, organizador }),
      atualizarOrganizador: (organizador) => definir({ ...sessao, organizador }),
      sair: async () => {
        await api.sair().catch(() => {});
        definir(null);
      },
    }),
    [sessao, definir],
  );

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>;
}

export function useSessao() {
  const contexto = useContext(ContextoSessao);
  if (!contexto) throw new Error('useSessao precisa estar dentro de <ProvedorSessao>.');
  return contexto;
}

// Rotas da área do organizador: sem login, manda para /entrar e volta depois.
export function RotaProtegida({ children }) {
  const { logado } = useSessao();
  const local = useLocation();
  if (!logado) {
    return <Navigate to={`/entrar?voltar=${encodeURIComponent(local.pathname + local.search)}`} replace />;
  }
  return children;
}
