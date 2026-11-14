import { useCallback, useEffect, useState } from 'react';

// Carrega dados de uma função assíncrona; com intervaloMs, recarrega periodicamente
// sem voltar ao estado de "carregando" (usado no contador em tempo real do PBI-05).
// `recarregar()` busca de novo na hora (ex.: contador logo após uma inscrição, PBI-10).
export function useDados(carregar, dependencias, intervaloMs) {
  const [estado, setEstado] = useState({ dados: null, erro: null, carregando: true });
  const carregarMemo = useCallback(carregar, dependencias);
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let ativo = true;
    setEstado((atual) => ({ ...atual, carregando: true, erro: null }));

    const executar = () =>
      carregarMemo()
        .then((dados) => ativo && setEstado({ dados, erro: null, carregando: false }))
        .catch((erro) => ativo && setEstado((atual) => ({ ...atual, erro, carregando: false })));

    executar();
    const timer = intervaloMs ? setInterval(executar, intervaloMs) : null;
    return () => {
      ativo = false;
      if (timer) clearInterval(timer);
    };
  }, [carregarMemo, intervaloMs, versao]);

  return { ...estado, recarregar };
}
