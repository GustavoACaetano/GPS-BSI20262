// PBI-06: guarda neste navegador os códigos de edição das aulas cadastradas,
// para o instrutor não precisar digitá-los. É só uma conveniência: se o
// armazenamento falhar, o código continua valendo quando informado à mão.
const CHAVE = 'gobeach:codigos-edicao';

function ler() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) || {};
  } catch {
    return {};
  }
}

export function obterCodigoEdicao(id) {
  return ler()[id] || '';
}

export function salvarCodigoEdicao(id, codigo) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ ...ler(), [id]: codigo }));
  } catch {
    // Sem armazenamento disponível (ex.: janela anônima): ignora.
  }
}
