import { useState } from 'react';
import { api } from '../api.js';
import { useDados } from '../hooks.js';

// PBI-06: formulário de cadastro/edição de aulas, com validação dos campos
// obrigatórios no navegador e exibição dos erros devolvidos pela API.

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const MODALIDADES = ['Surf', 'Futevôlei', 'Vôlei de praia', 'Stand Up Paddle', 'Beach tennis', 'Treino funcional'];

export const AULA_VAZIA = {
  titulo: '',
  modalidade: '',
  praiaId: '',
  localDetalhe: '',
  diasSemana: [],
  horaInicio: '',
  horaFim: '',
  instrutor: '',
  contato: '',
  descricao: '',
};

// Converte uma aula da API para os valores do formulário.
export const aulaParaFormulario = (aula) => ({
  titulo: aula.titulo,
  modalidade: aula.modalidade,
  praiaId: String(aula.praia.id),
  localDetalhe: aula.localDetalhe || '',
  diasSemana: aula.diasSemana.split(',').map((dia) => dia.trim()).filter(Boolean),
  horaInicio: aula.horaInicio,
  horaFim: aula.horaFim,
  instrutor: aula.instrutor,
  contato: aula.contato || '',
  descricao: aula.descricao || '',
});

const OBRIGATORIOS = {
  titulo: 'Título é obrigatório.',
  modalidade: 'Modalidade é obrigatório.',
  praiaId: 'Selecione a praia.',
  horaInicio: 'Informe o horário de início (HH:MM).',
  horaFim: 'Informe o horário de término (HH:MM).',
  instrutor: 'Instrutor é obrigatório.',
  contato: 'Contato é obrigatório.',
};

export function validarFormulario(valores) {
  const erros = {};
  for (const [campo, mensagem] of Object.entries(OBRIGATORIOS)) {
    if (!String(valores[campo]).trim()) erros[campo] = mensagem;
  }
  if (valores.diasSemana.length === 0) erros.diasSemana = 'Selecione ao menos um dia da semana.';
  if (!erros.horaInicio && !erros.horaFim && valores.horaFim <= valores.horaInicio) {
    erros.horaFim = 'O término deve ser depois do início.';
  }
  return erros;
}

function Campo({ id, rotulo, erro, obrigatorio, children, dica }) {
  return (
    <div className={`campo${erro ? ' campo--erro' : ''}`}>
      <label htmlFor={id}>
        {rotulo}
        {obrigatorio && <span className="obrigatorio" aria-hidden="true"> *</span>}
      </label>
      {children}
      {dica && !erro && <small className="campo__dica">{dica}</small>}
      {erro && (
        <small id={`${id}-erro`} className="campo__erro">
          {erro}
        </small>
      )}
    </div>
  );
}

export default function FormularioAula({ inicial = AULA_VAZIA, rotuloEnviar, aoEnviar, children }) {
  const [valores, setValores] = useState(inicial);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const { dados: praias } = useDados(() => api.listarPraias({ limite: 100 }), []);

  const alterar = (campo) => (evento) => {
    setValores((atual) => ({ ...atual, [campo]: evento.target.value }));
    setErros((atual) => ({ ...atual, [campo]: undefined }));
  };

  const alternarDia = (dia) => {
    setValores((atual) => ({
      ...atual,
      diasSemana: atual.diasSemana.includes(dia)
        ? atual.diasSemana.filter((d) => d !== dia)
        : [...atual.diasSemana, dia],
    }));
    setErros((atual) => ({ ...atual, diasSemana: undefined }));
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    setErroGeral(null);
    const encontrados = validarFormulario(valores);
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) {
      setErroGeral('Revise os campos destacados.');
      return;
    }

    setEnviando(true);
    try {
      await aoEnviar({ ...valores, praiaId: Number(valores.praiaId) });
    } catch (erro) {
      setErros(erro.campos || {});
      setErroGeral(erro.message);
    } finally {
      setEnviando(false);
    }
  };

  const atributos = (campo) => ({
    id: campo,
    name: campo,
    value: valores[campo],
    onChange: alterar(campo),
    'aria-invalid': Boolean(erros[campo]),
    'aria-describedby': erros[campo] ? `${campo}-erro` : undefined,
  });

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      {children}

      <fieldset>
        <legend>Sobre a aula</legend>
        <Campo id="titulo" rotulo="Título" erro={erros.titulo} obrigatorio>
          <input {...atributos('titulo')} maxLength={160} placeholder="Ex.: Escolinha de Surf para iniciantes" />
        </Campo>
        <Campo id="modalidade" rotulo="Modalidade" erro={erros.modalidade} obrigatorio>
          <input {...atributos('modalidade')} maxLength={60} list="modalidades" />
          <datalist id="modalidades">
            {MODALIDADES.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Campo>
        <Campo id="descricao" rotulo="Descrição" erro={erros.descricao} dica="Nível, idade, material incluso…">
          <textarea {...atributos('descricao')} maxLength={2000} rows={3} />
        </Campo>
      </fieldset>

      <fieldset>
        <legend>Onde e quando</legend>
        <Campo id="praiaId" rotulo="Praia" erro={erros.praiaId} obrigatorio>
          <select {...atributos('praiaId')}>
            <option value="">{praias ? 'Selecione…' : 'Carregando praias…'}</option>
            {praias?.dados.map((praia) => (
              <option key={praia.id} value={praia.id}>
                {praia.nome} · {praia.municipio}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="localDetalhe" rotulo="Local na praia" erro={erros.localDetalhe} dica="Ponto de referência para os alunos.">
          <input {...atributos('localDetalhe')} maxLength={160} placeholder="Ex.: Em frente ao quiosque 12" />
        </Campo>

        <div className={`campo${erros.diasSemana ? ' campo--erro' : ''}`}>
          <span className="campo__rotulo" id="dias-rotulo">
            Dias da semana<span className="obrigatorio" aria-hidden="true"> *</span>
          </span>
          <div className="dias" role="group" aria-labelledby="dias-rotulo">
            {DIAS_SEMANA.map((dia) => (
              <label key={dia} className="dia">
                <input
                  type="checkbox"
                  checked={valores.diasSemana.includes(dia)}
                  onChange={() => alternarDia(dia)}
                />
                <span>{dia}</span>
              </label>
            ))}
          </div>
          {erros.diasSemana && <small className="campo__erro">{erros.diasSemana}</small>}
        </div>

        <div className="campos-lado">
          <Campo id="horaInicio" rotulo="Início" erro={erros.horaInicio} obrigatorio>
            <input type="time" {...atributos('horaInicio')} />
          </Campo>
          <Campo id="horaFim" rotulo="Término" erro={erros.horaFim} obrigatorio>
            <input type="time" {...atributos('horaFim')} />
          </Campo>
        </div>
      </fieldset>

      <fieldset>
        <legend>Instrutor</legend>
        <Campo id="instrutor" rotulo="Nome do instrutor" erro={erros.instrutor} obrigatorio>
          <input {...atributos('instrutor')} maxLength={120} autoComplete="name" />
        </Campo>
        <Campo id="contato" rotulo="Contato" erro={erros.contato} obrigatorio dica="WhatsApp, telefone ou e-mail.">
          <input {...atributos('contato')} maxLength={120} />
        </Campo>
      </fieldset>

      {erroGeral && (
        <p className="estado--erro formulario__erro" role="alert">
          {erroGeral}
        </p>
      )}
      <button type="submit" className="botao" disabled={enviando}>
        {enviando ? 'Enviando…' : rotuloEnviar}
      </button>
    </form>
  );
}
