import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AvisoStatus } from '../components/AtividadeCards.jsx';
import { Campo, ErroFormulario, useFormulario } from '../components/Formulario.jsx';
import { Carregando, Erro } from '../components/Estado.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';

// PBI-12: o organizador dono adia, cancela ou reativa uma atividade, com um aviso aos participantes.

// Opções possíveis a partir do status atual (o cancelamento é definitivo).
export function opcoesStatus(statusAtual) {
  const adiar = {
    valor: 'ADIADO',
    rotulo: statusAtual === 'ADIADO' ? 'Manter adiada e atualizar o aviso' : 'Adiar',
    descricao: 'A atividade continua visível com o selo "Adiado". Depois, defina a nova data na edição e reative.',
  };
  const cancelar = {
    valor: 'CANCELADO',
    rotulo: 'Cancelar',
    descricao: 'Definitivo: novas inscrições são bloqueadas e a atividade não pode mais ser editada nem reativada.',
  };
  const reativar = {
    valor: 'ATIVO',
    rotulo: 'Reativar',
    descricao: 'Remove o selo "Adiado" e o aviso. Confira antes se a data já foi atualizada.',
  };
  return statusAtual === 'ADIADO' ? [reativar, adiar, cancelar] : [adiar, cancelar];
}

export function validarStatus({ status, aviso, confirmaCancelamento }) {
  const erros = {};
  if (!status) erros.status = 'Escolha o que fazer.';
  if (status && status !== 'ATIVO') {
    const texto = aviso.trim();
    if (texto.length < 5) erros.aviso = 'Escreva um aviso para os participantes (mínimo de 5 caracteres).';
    else if (texto.length > 300) erros.aviso = 'O aviso deve ter no máximo 300 caracteres.';
  }
  if (status === 'CANCELADO' && !confirmaCancelamento) {
    erros.confirmaCancelamento = 'Confirme que entende que o cancelamento é definitivo.';
  }
  return erros;
}

function FormularioStatus({ atividade, aoConcluir }) {
  const opcoes = opcoesStatus(atividade.status);
  const { valores, erros, erroGeral, enviando, atributos, enviar, setValores } = useFormulario(
    { status: '', aviso: atividade.avisoStatus || '', confirmaCancelamento: false },
    {
      validar: validarStatus,
      aoEnviar: async ({ status, aviso }) => aoConcluir(await api.alterarStatus(atividade.id, status, aviso.trim())),
    },
  );
  const precisaAviso = valores.status && valores.status !== 'ATIVO';

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <fieldset>
        <legend>O que você quer fazer?</legend>
        <div className="opcoes opcoes--coluna" role="radiogroup" aria-label="Novo status">
          {opcoes.map((opcao) => (
            <label key={opcao.valor} className="opcao opcao--bloco">
              <input
                type="radio"
                name="status"
                value={opcao.valor}
                checked={valores.status === opcao.valor}
                onChange={atributos('status').onChange}
              />
              <span>
                {opcao.rotulo}
                <small>{opcao.descricao}</small>
              </span>
            </label>
          ))}
        </div>
        {erros.status && <small className="campo__erro">{erros.status}</small>}
      </fieldset>

      {precisaAviso && (
        <fieldset>
          <legend>Aviso aos participantes</legend>
          <Campo
            id="aviso"
            rotulo="Aviso"
            erro={erros.aviso}
            obrigatorio
            dica={`Aparece nas listagens e na página da atividade, e vai por e-mail para os inscritos. ${valores.aviso.trim().length}/300`}
          >
            <textarea {...atributos('aviso')} rows={3} maxLength={300} placeholder="Ex.: Adiado por causa da ressaca; nova data em breve." />
          </Campo>
          {valores.status === 'CANCELADO' && (
            <div className={`campo${erros.confirmaCancelamento ? ' campo--erro' : ''}`}>
              <label className="opcao">
                <input
                  type="checkbox"
                  checked={valores.confirmaCancelamento}
                  onChange={(e) => setValores((atual) => ({ ...atual, confirmaCancelamento: e.target.checked }))}
                />
                Entendo que o cancelamento é definitivo.
              </label>
              {erros.confirmaCancelamento && <small className="campo__erro">{erros.confirmaCancelamento}</small>}
            </div>
          )}
        </fieldset>
      )}

      <ErroFormulario>{erroGeral}</ErroFormulario>
      <button
        type="submit"
        className={`botao${valores.status === 'CANCELADO' ? ' botao--perigo' : ''}`}
        disabled={enviando}
      >
        {enviando ? 'Salvando…' : valores.status === 'CANCELADO' ? 'Cancelar atividade' : 'Salvar status'}
      </button>
    </form>
  );
}

export default function AlterarStatusPage() {
  const { id } = useParams();
  const { dados: atividade, erro, carregando } = useDados(() => api.obterMinhaAtividade(id), [id]);
  const [resultado, setResultado] = useState(null);

  if (erro) return <Erro erro={erro} />;
  if (carregando && !atividade) return <Carregando />;

  const realizada = atividade.tipo !== 'AULA' && new Date(atividade.dataInicio) <= new Date();

  if (resultado) {
    const { atividade: salva, avisados } = resultado;
    const mensagens = {
      ATIVO: 'Atividade reativada. O selo e o aviso foram removidos.',
      ADIADO: 'Atividade marcada como adiada. O aviso já aparece nas listagens.',
      CANCELADO: 'Atividade cancelada. O aviso já aparece nas listagens, e novas inscrições estão bloqueadas.',
    };
    return (
      <section className="detalhe">
        <div className="painel painel--propria" role="status">
          <h1>Status atualizado</h1>
          <p>{mensagens[salva.status]}</p>
          {salva.status !== 'ATIVO' && (
            <p className="texto-suave">
              {avisados > 0
                ? `Enviamos o aviso por e-mail para ${avisados} ${avisados === 1 ? 'inscrito' : 'inscritos'}.`
                : 'Nenhum inscrito deixou e-mail; o aviso fica visível na plataforma.'}
            </p>
          )}
        </div>
        <div className="acoes">
          {salva.publicada && <Link to={`/atividades/${salva.id}`} className="botao">Ver atividade</Link>}
          <Link to="/minha-area" className="botao botao--secundario">Ir para Minha área</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="detalhe">
      <Link to="/minha-area" className="voltar">← Minha área</Link>
      <div className="titulo-pagina">
        <h1>Adiar ou cancelar</h1>
        <p>
          <strong>{atividade.titulo}</strong> · {atividade.interessados ?? 0}{' '}
          {atividade.interessados === 1 ? 'inscrito' : 'inscritos'}
        </p>
      </div>
      <AvisoStatus atividade={atividade} />
      {atividade.status === 'CANCELADO' ? (
        <p className="estado" role="status">Esta atividade foi cancelada. O cancelamento é definitivo.</p>
      ) : realizada ? (
        <p className="estado" role="status">Esta atividade já aconteceu; o status não pode mais ser alterado.</p>
      ) : (
        <FormularioStatus atividade={atividade} aoConcluir={setResultado} />
      )}
    </section>
  );
}
