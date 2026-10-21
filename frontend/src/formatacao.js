const dataHora = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

const dataLonga = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatarDataHora = (iso) => dataHora.format(new Date(iso));
export const formatarDataEvento = (iso) => dataLonga.format(new Date(iso));
export const formatarMoeda = (valor) => moeda.format(valor);

// 'YYYY-MM-DD' -> 'DD/MM/YYYY' sem conversão de fuso.
export const formatarData = (texto) => texto.split('-').reverse().join('/');
