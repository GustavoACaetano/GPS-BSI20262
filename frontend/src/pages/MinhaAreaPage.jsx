import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Campo, ErroFormulario, erroSenha, useFormulario } from '../components/Formulario.jsx';
import { Carregando, Erro, Vazio } from '../components/Estado.jsx';
import SeloStatus from '../components/SeloStatus.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';
import { useSessao } from '../sessao.jsx';
import { formatarDataEvento } from '../formatacao.js';
import { textoVagas } from '../components/AtividadeCards.jsx';

// Seções de "Minhas publicações" por tipo (PBI-06 aulas, PBI-07 eventos, PBI-08 ações).
const SECOES = [
  {
    tipo: 'AULA',
    titulo: 'Minhas aulas',
    caminho: 'aulas',
    rotaNovo: '/aulas/nova',
    novo: '+ Cadastrar aula',
    vazio: 'Você ainda não cadastrou nenhuma aula.',
    resumo: (a) => `${a.modalidade} · ${a.praia.nome} · ${a.diasSemana} · ${a.horaInicio}–${a.horaFim}`,
  },
  {
    tipo: 'EVENTO',
    titulo: 'Meus eventos esportivos',
    caminho: 'eventos',
    rotaNovo: '/eventos/novo',
    novo: '+ Cadastrar evento',
    vazio: 'Você ainda não cadastrou nenhum evento esportivo.',
    resumo: (e) => `${e.modalidade} · ${e.praia.nome} · ${formatarDataEvento(e.dataInicio)} · ${textoVagas(e)}`,
  },
  {
    tipo: 'ACAO_COMUNITARIA',
    titulo: 'Minhas ações comunitárias',
    caminho: 'acoes',
    rotaNovo: '/acoes/nova',
    novo: '+ Cadastrar ação',
    vazio: 'Você ainda não cadastrou nenhuma ação comunitária.',
    resumo: (a) => `${a.praia.nome} · ${formatarDataEvento(a.dataInicio)} · ${a.interessados} voluntários`,
  },
];

// Eventos e ações com data passada já aconteceram: saem das abas públicas e não são editáveis.
const jaAconteceu = (atividade) => Boolean(atividade.dataInicio) && new Date(atividade.dataInicio) <= new Date();

function SecaoPublicacoes({ secao, dados }) {
  const itens = dados.dados.filter((a) => a.tipo === secao.tipo);
  return (
    <section className="painel painel--neutro">
      <div className="titulo-pagina--acao">
        <h2>{secao.titulo}</h2>
        <Link to={secao.rotaNovo} className="botao">{secao.novo}</Link>
      </div>
      {itens.length === 0 && <Vazio>{secao.vazio}</Vazio>}
      {itens.length > 0 && (
        <ul className="minhas">
          {itens.map((item) => {
            const encerrada = jaAconteceu(item);
            return (
              <li key={item.id}>
                <div>
                  <strong>{item.titulo}</strong>
                  <span className="texto-suave">{secao.resumo(item)}</span>
                </div>
                <div className="minhas__acoes">
                  {encerrada ? (
                    <span className="tag tag--neutra">Realizada</span>
                  ) : item.publicada ? (
                    <span className="tag tag--propria">Publicada</span>
                  ) : (
                    <span className="tag tag--alerta">Aguardando aprovação</span>
                  )}
                  <SeloStatus status={item.status} />
                  {item.publicada && <Link to={`/atividades/${item.id}`}>Ver</Link>}
                  <Link to={`/minha-area/inscritos/${item.id}`}>Inscritos ({item.interessados ?? 0})</Link>
                  {!encerrada && item.status !== 'CANCELADO' && (
                    <>
                      <Link to={`/${secao.caminho}/${item.id}/editar`}>Editar</Link>
                      {/* PBI-12 */}
                      <Link to={`/minha-area/status/${item.id}`}>Status</Link>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function MinhasPublicacoes() {
  const { dados, erro, carregando } = useDados(() => api.listarMinhasAtividades(), []);
  if (erro) return <Erro erro={erro} />;
  if (carregando && !dados) return <Carregando />;
  return SECOES.map((secao) => <SecaoPublicacoes key={secao.tipo} secao={secao} dados={dados} />);
}

function Perfil() {
  const { organizador, atualizarOrganizador } = useSessao();
  const [salvo, setSalvo] = useState(false);
  const { erros, erroGeral, enviando, atributos, enviar } = useFormulario(
    { nome: organizador.nome, telefone: organizador.telefone || '' },
    {
      validar: ({ nome }) => (nome.trim() ? {} : { nome: 'Nome é obrigatório.' }),
      aoEnviar: async (valores) => {
        setSalvo(false);
        atualizarOrganizador(await api.atualizarPerfil(valores));
        setSalvo(true);
      },
    },
  );

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <fieldset>
        <legend>Perfil</legend>
        <p className="texto-suave">E-mail de acesso: {organizador.email}</p>
        <Campo id="nome" rotulo="Nome ou escola" erro={erros.nome} obrigatorio>
          <input maxLength={120} {...atributos('nome')} />
        </Campo>
        <Campo id="telefone" rotulo="Telefone / WhatsApp" erro={erros.telefone}>
          <input type="tel" maxLength={40} {...atributos('telefone')} />
        </Campo>
      </fieldset>
      <ErroFormulario>{erroGeral}</ErroFormulario>
      {salvo && <p className="texto-sucesso" role="status">Perfil atualizado.</p>}
      <button type="submit" className="botao" disabled={enviando}>
        {enviando ? 'Salvando…' : 'Salvar perfil'}
      </button>
    </form>
  );
}

function TrocarSenha() {
  const [salvo, setSalvo] = useState(false);
  const { erros, erroGeral, enviando, atributos, enviar, setValores } = useFormulario(
    { senhaAtual: '', novaSenha: '' },
    {
      validar: ({ senhaAtual, novaSenha }) => {
        const erros = {};
        if (!senhaAtual) erros.senhaAtual = 'Informe a senha atual.';
        const problema = erroSenha(novaSenha);
        if (problema) erros.novaSenha = problema;
        return erros;
      },
      aoEnviar: async ({ senhaAtual, novaSenha }) => {
        setSalvo(false);
        await api.trocarSenha(senhaAtual, novaSenha);
        setValores({ senhaAtual: '', novaSenha: '' });
        setSalvo(true);
      },
    },
  );

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <fieldset>
        <legend>Trocar senha</legend>
        <Campo id="senhaAtual" rotulo="Senha atual" erro={erros.senhaAtual}>
          <input type="password" autoComplete="current-password" {...atributos('senhaAtual')} />
        </Campo>
        <Campo id="novaSenha" rotulo="Nova senha" erro={erros.novaSenha} dica="Mínimo de 8 caracteres, com letras e números.">
          <input type="password" autoComplete="new-password" {...atributos('novaSenha')} />
        </Campo>
      </fieldset>
      <ErroFormulario>{erroGeral}</ErroFormulario>
      {salvo && (
        <p className="texto-sucesso" role="status">Senha alterada. Outros aparelhos foram desconectados.</p>
      )}
      <button type="submit" className="botao botao--secundario" disabled={enviando}>
        {enviando ? 'Salvando…' : 'Trocar senha'}
      </button>
    </form>
  );
}

// PBI-11: área do organizador para gerenciar perfil e publicações.
export default function MinhaAreaPage() {
  const { organizador, sair } = useSessao();
  const navegar = useNavigate();

  return (
    <section className="detalhe">
      <div className="titulo-pagina titulo-pagina--acao">
        <div>
          <h1>Minha área</h1>
          <p>Olá, {organizador.nome}! Gerencie suas publicações e seus dados.</p>
        </div>
        <button
          type="button"
          className="botao botao--secundario"
          onClick={() => {
            // Sai da rota protegida antes de encerrar a sessão (senão ela redireciona para /entrar).
            navegar('/praias');
            sair();
          }}
        >
          Sair
        </button>
      </div>
      <MinhasPublicacoes />
      <Perfil />
      <TrocarSenha />
    </section>
  );
}
