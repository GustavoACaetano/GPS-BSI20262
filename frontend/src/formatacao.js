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

// PBI-09: períodos rápidos do filtro "Quando" (datas 'YYYY-MM-DD' no horário de Brasília).
const UM_DIA_MS = 24 * 60 * 60 * 1000;

export function somarDias(data, dias) {
  return new Date(new Date(`${data}T12:00:00Z`).getTime() + dias * UM_DIA_MS).toISOString().slice(0, 10);
}

// 0 = domingo ... 6 = sábado
export const diaDaSemana = (data) => new Date(`${data}T12:00:00Z`).getUTCDay();

export const PERIODOS = [
  { valor: '', rotulo: 'Qualquer data' },
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'fim-de-semana', rotulo: 'Neste fim de semana' },
  { valor: '7dias', rotulo: 'Próximos 7 dias' },
  { valor: '30dias', rotulo: 'Próximos 30 dias' },
  { valor: 'personalizado', rotulo: 'Escolher datas…' },
];

// Converte o período escolhido em { de, ate }; null quando não há filtro de data.
export function calcularPeriodo(periodo, hoje = hojeLocal(), personalizado = {}) {
  switch (periodo) {
    case 'hoje':
      return { de: hoje, ate: hoje };
    case 'fim-de-semana': {
      // De hoje (se já for sábado/domingo) ou do próximo sábado até o domingo.
      const dia = diaDaSemana(hoje);
      if (dia === 0) return { de: hoje, ate: hoje };
      const sabado = dia === 6 ? hoje : somarDias(hoje, 6 - dia);
      return { de: sabado, ate: somarDias(sabado, 1) };
    }
    case '7dias':
      return { de: hoje, ate: somarDias(hoje, 6) };
    case '30dias':
      return { de: hoje, ate: somarDias(hoje, 29) };
    case 'personalizado': {
      const { de, ate } = personalizado;
      return de && ate && de <= ate ? { de, ate } : null;
    }
    default:
      return null;
  }
}
