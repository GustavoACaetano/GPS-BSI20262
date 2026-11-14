import { Campo, ErroFormulario, SelectPraia, useFormulario } from './Formulario.jsx';
import { deDataHoraLocal, hojeLocal, paraDataHoraLocal } from '../formatacao.js';

// PBI-08: formulário de cadastro/edição de ações comunitárias (mutirões ambientais).

export const ACAO_VAZIA = {
  titulo: '',
  objetivoAmbiental: '',
  apoioLocal: '',
  descricao: '',
  praiaId: '',
  pontoEncontro: '',
  data: '',
  hora: '',
  responsavel: '',
  contato: '',
  recomendacoes: '',
};

// Converte uma ação da API para os valores do formulário.
export const acaoParaFormulario = (acao) => ({
  titulo: acao.titulo,
  objetivoAmbiental: acao.objetivoAmbiental,
  apoioLocal: acao.apoioLocal || '',
  descricao: acao.descricao || '',
  praiaId: String(acao.praia.id),
  pontoEncontro: acao.pontoEncontro,
  ...paraDataHoraLocal(acao.dataInicio),
  responsavel: acao.responsavel,
  contato: acao.contato || '',
  recomendacoes: acao.recomendacoes.join('\n'),
});

// Uma recomendação por linha, sem linhas vazias.
export const linhasRecomendacoes = (texto) =>
  texto.split('\n').map((linha) => linha.trim()).filter(Boolean);

const OBRIGATORIOS = {
  titulo: 'Título é obrigatório.',
  objetivoAmbiental: 'Objetivo ecológico é obrigatório.',
  praiaId: 'Selecione a praia.',
  pontoEncontro: 'Ponto de encontro é obrigatório.',
  data: 'Informe a data da ação.',
  hora: 'Informe o horário de início (HH:MM).',
  responsavel: 'Organização responsável é obrigatório.',
  contato: 'Contato é obrigatório.',
};

export function validarAcao(valores, agora = new Date()) {
  const erros = {};
  for (const [campo, mensagem] of Object.entries(OBRIGATORIOS)) {
    if (!String(valores[campo]).trim()) erros[campo] = mensagem;
  }
  if (!erros.data && !erros.hora && deDataHoraLocal(valores.data, valores.hora) <= agora) {
    erros.data = 'A ação deve acontecer em uma data futura.';
  }
  const itens = linhasRecomendacoes(valores.recomendacoes);
  if (itens.length > 10) erros.recomendacoes = 'Informe no máximo 10 recomendações.';
  else if (itens.some((item) => item.length > 120)) {
    erros.recomendacoes = 'Cada recomendação deve ter no máximo 120 caracteres.';
  }
  return erros;
}

export default function FormularioAcao({ inicial = ACAO_VAZIA, rotuloEnviar, aoEnviar }) {
  const { erros, erroGeral, enviando, atributos, enviar } = useFormulario(inicial, {
    validar: (valores) => validarAcao(valores),
    aoEnviar: (valores) =>
      aoEnviar({
        ...valores,
        praiaId: Number(valores.praiaId),
        recomendacoes: linhasRecomendacoes(valores.recomendacoes),
      }),
  });

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <fieldset>
        <legend>Sobre a ação</legend>
        <Campo id="titulo" rotulo="Título" erro={erros.titulo} obrigatorio>
          <input {...atributos('titulo')} maxLength={160} placeholder="Ex.: Mutirão de limpeza de Camburi" />
        </Campo>
        <Campo
          id="objetivoAmbiental"
          rotulo="Objetivo ecológico"
          erro={erros.objetivoAmbiental}
          obrigatorio
          dica="O que a ação pretende alcançar para o meio ambiente."
        >
          <textarea {...atributos('objetivoAmbiental')} maxLength={500} rows={2} placeholder="Ex.: Retirar resíduos sólidos da faixa de areia." />
        </Campo>
        <Campo
          id="apoioLocal"
          rotulo="Apoio local"
          erro={erros.apoioLocal}
          dica="Parceiros que apoiam a ação: prefeitura, comércio, associação de moradores…"
        >
          <input {...atributos('apoioLocal')} maxLength={300} placeholder="Ex.: Prefeitura (sacos e caçambas), quiosque 12 (água)" />
        </Campo>
        <Campo id="descricao" rotulo="Descrição" erro={erros.descricao}>
          <textarea {...atributos('descricao')} maxLength={2000} rows={3} />
        </Campo>
      </fieldset>

      <fieldset>
        <legend>Onde e quando</legend>
        <Campo id="praiaId" rotulo="Praia" erro={erros.praiaId} obrigatorio>
          <SelectPraia {...atributos('praiaId')} />
        </Campo>
        <Campo id="pontoEncontro" rotulo="Ponto de encontro" erro={erros.pontoEncontro} obrigatorio>
          <input {...atributos('pontoEncontro')} maxLength={160} placeholder="Ex.: Píer de Iemanjá" />
        </Campo>
        <div className="campos-lado">
          <Campo id="data" rotulo="Data" erro={erros.data} obrigatorio>
            <input type="date" min={hojeLocal()} {...atributos('data')} />
          </Campo>
          <Campo id="hora" rotulo="Horário de início" erro={erros.hora} obrigatorio>
            <input type="time" {...atributos('hora')} />
          </Campo>
        </div>
        <Campo
          id="recomendacoes"
          rotulo="Recomendações aos voluntários"
          erro={erros.recomendacoes}
          dica="Uma por linha (até 10). Ex.: Levar luvas"
        >
          <textarea {...atributos('recomendacoes')} rows={4} />
        </Campo>
      </fieldset>

      <fieldset>
        <legend>Organizador responsável</legend>
        <Campo id="responsavel" rotulo="Organização responsável" erro={erros.responsavel} obrigatorio>
          <input {...atributos('responsavel')} maxLength={120} placeholder="ONG, coletivo ou líder comunitário" />
        </Campo>
        <Campo id="contato" rotulo="Contato" erro={erros.contato} obrigatorio dica="WhatsApp, telefone ou e-mail para os voluntários.">
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
