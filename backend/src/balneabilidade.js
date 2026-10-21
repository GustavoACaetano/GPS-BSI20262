// Regras de exibição da balneabilidade (PBI-02, mitiga o risco R1).

export const DIAS_LIMITE_ATUALIZACAO = 7;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

// Converte uma linha de boletim_balneabilidade no formato exposto pela API.
// Boletins sem data de coleta ou fonte não são exibidos (retorna null).
export function formatarBoletim(linha, agora = new Date()) {
  if (!linha || !linha.data_coleta || !linha.fonte || !linha.data_boletim) {
    return null;
  }

  const dataBoletim = new Date(linha.data_boletim);
  const diasDesdeBoletim = Math.floor((agora - dataBoletim) / UM_DIA_MS);

  return {
    id: linha.id,
    status: linha.status,
    dataColeta: linha.data_coleta,
    dataBoletim: dataBoletim.toISOString(),
    fonte: linha.fonte,
    diasDesdeBoletim,
    pendenteAtualizacao: diasDesdeBoletim > DIAS_LIMITE_ATUALIZACAO,
  };
}
