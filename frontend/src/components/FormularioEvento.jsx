import { Campo, ErroFormulario, SelectPraia, useFormulario } from './Formulario.jsx';
import { deDataHoraLocal, hojeLocal, paraDataHoraLocal } from '../formatacao.js';

// PBI-07: formulário de cadastro/edição de eventos esportivos.

const MODALIDADES = ['Surf', 'Futevôlei', 'Vôlei de praia', 'Beach tennis', 'Stand Up Paddle', 'Corrida', 'Natação em águas abertas'];

export const EVENTO_VAZIO = {
  titulo: '',
  modalidade: '',
  descricao: '',
  regulamento: '',
  praiaId: '',
  localDetalhe: '',
  data: '',
  hora: '',
  entrada: 'gratuito', // 'gratuito' | 'pago'
  valorInscricao: '',
  limiteVagas: '',
  responsavel: '',
  contato: '',
};

// Converte um evento da API para os valores do formulário.
export const eventoParaFormulario = (evento) => ({
  titulo: evento.titulo,
  modalidade: evento.modalidade,
  descricao: evento.descricao || '',
  regulamento: evento.regulamento || '',
  praiaId: String(evento.praia.id),
  localDetalhe: evento.localDetalhe,
  ...paraDataHoraLocal(evento.dataInicio),
  entrada: evento.gratuito ? 'gratuito' : 'pago',
  valorInscricao: evento.valorInscricao == null ? '' : String(evento.valorInscricao),
  limiteVagas: evento.limiteVagas == null ? '' : String(evento.limiteVagas),
  responsavel: evento.responsavel,
  contato: evento.contato || '',
});

// Valores do formulário -> corpo da API.
export const formularioParaEvento = ({ entrada, ...valores }) => ({
  ...valores,
  praiaId: Number(valores.praiaId),
  gratuito: entrada === 'gratuito',
  valorInscricao: entrada === 'gratuito' ? null : Number(valores.valorInscricao.replace(',', '.')),
  limiteVagas: valores.limiteVagas.trim() === '' ? null : Number(valores.limiteVagas),
});

const OBRIGATORIOS = {
  titulo: 'Título é obrigatório.',
  modalidade: 'Modalidade é obrigatório.',
  regulamento: 'Regulamento é obrigatório.',
  praiaId: 'Selecione a praia.',
  localDetalhe: 'Local na praia é obrigatório.',
  data: 'Informe a data do evento.',
  hora: 'Informe o horário de início (HH:MM).',
  responsavel: 'Organizador do evento é obrigatório.',
  contato: 'Contato é obrigatório.',
};

export function validarEvento(valores, agora = new Date()) {
  const erros = {};
  for (const [campo, mensagem] of Object.entries(OBRIGATORIOS)) {
    if (!String(valores[campo]).trim()) erros[campo] = mensagem;
  }
  if (!erros.data && !erros.hora && deDataHoraLocal(valores.data, valores.hora) <= agora) {
    erros.data = 'O evento deve acontecer em uma data futura.';
  }
  if (valores.entrada === 'pago') {
    const valor = Number(valores.valorInscricao.replace(',', '.'));
    if (!valores.valorInscricao.trim() || !Number.isFinite(valor) || valor <= 0) {
      erros.valorInscricao = 'Informe o valor da inscrição.';
    }
  }
  if (valores.limiteVagas.trim() !== '') {
    const vagas = Number(valores.limiteVagas);
    if (!Number.isInteger(vagas) || vagas < 1) {
      erros.limiteVagas = 'O limite de vagas deve ser um número inteiro maior que zero.';
    }
  }
  return erros;
}

export default function FormularioEvento({ inicial = EVENTO_VAZIO, rotuloEnviar, aoEnviar }) {
  const { valores, erros, erroGeral, enviando, atributos, enviar } = useFormulario(inicial, {
    validar: (v) => validarEvento(v),
    aoEnviar: (v) => aoEnviar(formularioParaEvento(v)),
  });
  const pago = valores.entrada === 'pago';

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <fieldset>
        <legend>Sobre o evento</legend>
        <Campo id="titulo" rotulo="Título" erro={erros.titulo} obrigatorio>
          <input {...atributos('titulo')} maxLength={160} placeholder="Ex.: Torneio de Futevôlei de Verão" />
        </Campo>
        <Campo id="modalidade" rotulo="Modalidade" erro={erros.modalidade} obrigatorio>
          <input {...atributos('modalidade')} maxLength={60} list="modalidades-evento" />
          <datalist id="modalidades-evento">
            {MODALIDADES.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Campo>
        <Campo id="descricao" rotulo="Descrição" erro={erros.descricao} dica="Categorias, premiação, atrações…">
          <textarea {...atributos('descricao')} maxLength={2000} rows={3} />
        </Campo>
        <Campo
          id="regulamento"
          rotulo="Regulamento"
          erro={erros.regulamento}
          obrigatorio
          dica="Regras de participação: categorias, idade mínima, formato das partidas, equipamentos obrigatórios…"
        >
          <textarea {...atributos('regulamento')} maxLength={5000} rows={6} />
        </Campo>
      </fieldset>

      <fieldset>
        <legend>Onde e quando</legend>
        <Campo id="praiaId" rotulo="Praia" erro={erros.praiaId} obrigatorio>
          <SelectPraia {...atributos('praiaId')} />
        </Campo>
        <Campo id="localDetalhe" rotulo="Local na praia" erro={erros.localDetalhe} obrigatorio>
          <input {...atributos('localDetalhe')} maxLength={160} placeholder="Ex.: Arena montada no posto 4" />
        </Campo>
        <div className="campos-lado">
          <Campo id="data" rotulo="Data" erro={erros.data} obrigatorio>
            <input type="date" min={hojeLocal()} {...atributos('data')} />
          </Campo>
          <Campo id="hora" rotulo="Horário de início" erro={erros.hora} obrigatorio>
            <input type="time" {...atributos('hora')} />
          </Campo>
        </div>
      </fieldset>

      <fieldset>
        <legend>Inscrição e vagas</legend>
        <div className="campo">
          <span className="campo__rotulo" id="entrada-rotulo">Entrada</span>
          <div className="opcoes" role="radiogroup" aria-labelledby="entrada-rotulo">
            {[
              ['gratuito', 'Gratuito'],
              ['pago', 'Com taxa de inscrição'],
            ].map(([valor, rotulo]) => (
              <label key={valor} className="opcao">
                <input
                  type="radio"
                  name="entrada"
                  value={valor}
                  checked={valores.entrada === valor}
                  onChange={atributos('entrada').onChange}
                />
                {rotulo}
              </label>
            ))}
          </div>
        </div>
        <div className="campos-lado">
          {pago && (
            <Campo id="valorInscricao" rotulo="Valor da inscrição (R$)" erro={erros.valorInscricao} obrigatorio>
              <input type="number" min="0.01" step="0.01" inputMode="decimal" {...atributos('valorInscricao')} />
            </Campo>
          )}
          <Campo id="limiteVagas" rotulo="Limite de vagas" erro={erros.limiteVagas} dica="Deixe em branco se não houver limite.">
            <input type="number" min="1" step="1" inputMode="numeric" {...atributos('limiteVagas')} />
          </Campo>
        </div>
      </fieldset>

      <fieldset>
        <legend>Organizador e contato</legend>
        <Campo id="responsavel" rotulo="Organizador do evento" erro={erros.responsavel} obrigatorio>
          <input {...atributos('responsavel')} maxLength={120} placeholder="Liga, federação, clube ou pessoa" />
        </Campo>
        <Campo id="contato" rotulo="Contato" erro={erros.contato} obrigatorio dica="WhatsApp, telefone ou e-mail para dúvidas dos atletas.">
          <input {...atributos('contato')} maxLength={120} />
        </Campo>
      </fieldset>

      <ErroFormulario>{erroGeral}</ErroFormulario>
      <button type="submit" className="botao" disabled={enviando}>
        {enviando ? 'Enviando…' : rotuloEnviar}
      </button>
    </form>
  );
}
