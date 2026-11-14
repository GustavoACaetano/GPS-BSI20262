import { useState } from 'react';
import { Campo, ErroFormulario, useFormulario } from './Formulario.jsx';
import { vagasRestantes } from './AtividadeCards.jsx';
import { api } from '../api.js';

// PBI-10: inscrição / demonstração de interesse em aulas, eventos e ações.

const TEXTOS = {
  AULA: { titulo: 'Tenho interesse', botao: 'Quero participar', confirmado: 'Interesse registrado!' },
  EVENTO: { titulo: 'Inscrição', botao: 'Inscrever-se', confirmado: 'Inscrição confirmada!' },
  ACAO_COMUNITARIA: { titulo: 'Seja voluntário', botao: 'Confirmar presença', confirmado: 'Presença confirmada!' },
};

// Lembra neste navegador em quais atividades a pessoa já se inscreveu (só conveniência visual).
const CHAVE = 'gobeach:inscricoes';
function lerInscricoes() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) || {};
  } catch {
    return {};
  }
}
function lembrarInscricao(id, nome) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ ...lerInscricoes(), [id]: nome }));
  } catch {
    // Sem armazenamento disponível: a confirmação só vale nesta visita.
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mesmas regras da API: e-mail ou telefone com DDD (10 ou 11 dígitos, com ou sem +55).
export function contatoValido(contato) {
  const texto = contato.trim();
  if (texto.includes('@')) return EMAIL.test(texto);
  if (!/^[\d\s()+-]+$/.test(texto)) return false;
  let digitos = texto.replace(/\D/g, '');
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) digitos = digitos.slice(2);
  return digitos.length === 10 || digitos.length === 11;
}

export function validarInscricao({ nome, contato, consentimento }) {
  const erros = {};
  if (nome.trim().length < 2) erros.nome = 'Informe seu nome.';
  if (!contato.trim()) erros.contato = 'Informe seu e-mail ou WhatsApp.';
  else if (!contatoValido(contato)) erros.contato = 'Informe um e-mail válido ou um WhatsApp com DDD.';
  if (!consentimento) erros.consentimento = 'É preciso autorizar o envio do seu contato ao organizador.';
  return erros;
}

// Situação da atividade para inscrição: null = aberta.
export function situacaoInscricao(atividade, agora = new Date()) {
  if (atividade.status === 'CANCELADO') return 'Esta atividade foi cancelada pelo organizador.';
  if (atividade.tipo !== 'AULA' && new Date(atividade.dataInicio) <= agora) {
    return 'As inscrições foram encerradas: a atividade já aconteceu.';
  }
  if (vagasRestantes(atividade) === 0) return 'As vagas desta atividade estão esgotadas.';
  return null;
}

export default function FormularioInscricao({ atividade, aoInscrever }) {
  const textos = TEXTOS[atividade.tipo];
  const [confirmacao, setConfirmacao] = useState(null);
  const [jaInscrito] = useState(() => lerInscricoes()[atividade.id]);

  const { valores, erros, erroGeral, enviando, atributos, enviar, setValores } = useFormulario(
    { nome: '', contato: '', consentimento: false },
    {
      validar: validarInscricao,
      aoEnviar: async ({ nome, contato, consentimento }) => {
        try {
          const resposta = await api.inscrever(atividade.id, { nome: nome.trim(), contato, consentimento });
          lembrarInscricao(atividade.id, resposta.inscricao.nome);
          setConfirmacao(resposta);
          aoInscrever?.(resposta);
        } catch (erro) {
          // Vagas esgotadas ou atividade cancelada enquanto o formulário estava aberto: atualiza a tela.
          if (erro.status === 409 && !erro.campos?.contato) aoInscrever?.();
          throw erro;
        }
      },
    },
  );

  if (confirmacao) {
    const { inscricao, interessados, vagasRestantes: restantes } = confirmacao;
    return (
      <section className="painel painel--propria" role="status">
        <h2>{textos.confirmado}</h2>
        <p>
          Obrigado, {inscricao.nome}! O organizador recebeu seu contato e pode falar com você sobre os próximos passos.
        </p>
        <p className="contador">
          <strong>{interessados.toLocaleString('pt-BR')}</strong> {interessados === 1 ? 'pessoa inscrita' : 'pessoas inscritas'}
          {restantes != null && ` · ${restantes === 0 ? 'vagas esgotadas' : `${restantes} ${restantes === 1 ? 'vaga restante' : 'vagas restantes'}`}`}
        </p>
      </section>
    );
  }

  const situacao = situacaoInscricao(atividade);

  return (
    <section className="painel painel--neutro">
      <h2>{textos.titulo}</h2>
      {jaInscrito && (
        <p className="texto-sucesso">Você já se inscreveu nesta atividade neste navegador, como {jaInscrito}.</p>
      )}
      {situacao ? (
        <p className="texto-suave" role="status">{situacao}</p>
      ) : (
        <form className="formulario formulario--compacto" onSubmit={enviar} noValidate>
          <Campo id="inscricao-nome" rotulo="Seu nome" erro={erros.nome} obrigatorio>
            <input
              {...atributos('nome')}
              id="inscricao-nome"
              aria-describedby={erros.nome ? 'inscricao-nome-erro' : undefined}
              autoComplete="name"
              maxLength={120}
            />
          </Campo>
          <Campo id="inscricao-contato" rotulo="E-mail ou WhatsApp" erro={erros.contato} obrigatorio dica="Ex.: voce@email.com ou (27) 99999-0000">
            <input
              {...atributos('contato')}
              id="inscricao-contato"
              aria-describedby={erros.contato ? 'inscricao-contato-erro' : undefined}
              autoComplete="email"
              maxLength={120}
            />
          </Campo>
          <div className={`campo${erros.consentimento ? ' campo--erro' : ''}`}>
            <label className="opcao">
              <input
                type="checkbox"
                checked={valores.consentimento}
                onChange={(e) => setValores((atual) => ({ ...atual, consentimento: e.target.checked }))}
              />
              Autorizo o envio do meu nome e contato ao organizador desta atividade.
            </label>
            {erros.consentimento && <small className="campo__erro">{erros.consentimento}</small>}
          </div>
          <ErroFormulario>{erroGeral}</ErroFormulario>
          <button type="submit" className="botao" disabled={enviando}>
            {enviando ? 'Enviando…' : textos.botao}
          </button>
        </form>
      )}
    </section>
  );
}
