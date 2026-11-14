import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Campo, ErroFormulario, erroSenha, useFormulario } from '../components/Formulario.jsx';
import { Carregando, Erro, Vazio } from '../components/Estado.jsx';
import SeloStatus from '../components/SeloStatus.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';
import { useSessao } from '../sessao.jsx';

function MinhasAulas() {
  const { dados, erro, carregando } = useDados(() => api.listarMinhasAtividades(), []);
  const aulas = dados?.dados.filter((a) => a.tipo === 'AULA') ?? [];

  return (
    <section className="painel painel--neutro">
      <div className="titulo-pagina--acao">
        <h2>Minhas aulas</h2>
        <Link to="/aulas/nova" className="botao">+ Cadastrar aula</Link>
      </div>
      {erro && <Erro erro={erro} />}
      {carregando && !dados && <Carregando />}
      {dados && aulas.length === 0 && <Vazio>Você ainda não cadastrou nenhuma aula.</Vazio>}
      {aulas.length > 0 && (
        <ul className="minhas">
          {aulas.map((aula) => (
            <li key={aula.id}>
              <div>
                <strong>{aula.titulo}</strong>
                <span className="texto-suave">
                  {aula.modalidade} · {aula.praia.nome} · {aula.diasSemana} · {aula.horaInicio}–{aula.horaFim}
                </span>
              </div>
              <div className="minhas__acoes">
                {aula.publicada ? (
                  <span className="tag tag--propria">Publicada</span>
                ) : (
                  <span className="tag tag--alerta">Aguardando aprovação</span>
                )}
                <SeloStatus status={aula.status} />
                {aula.publicada && <Link to={`/atividades/${aula.id}`}>Ver</Link>}
                <Link to={`/aulas/${aula.id}/editar`}>Editar</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
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
      <MinhasAulas />
      <Perfil />
      <TrocarSenha />
    </section>
  );
}
