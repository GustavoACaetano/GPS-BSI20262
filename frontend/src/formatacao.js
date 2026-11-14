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

// PBI-08: instante ISO -> { data: 'YYYY-MM-DD', hora: 'HH:MM' } no horário de Brasília (formulário de edição).
const partesLocais = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function paraDataHoraLocal(iso) {
  const p = Object.fromEntries(partesLocais.formatToParts(new Date(iso)).map(({ type, value }) => [type, value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

// Data/hora digitadas no formulário (horário de Brasília) -> Date.
export const deDataHoraLocal = (data, hora) => new Date(`${data}T${hora}:00-03:00`);

// Hoje em Brasília, 'YYYY-MM-DD' (mínimo do campo de data).
export const hojeLocal = () => paraDataHoraLocal(new Date().toISOString()).data;
