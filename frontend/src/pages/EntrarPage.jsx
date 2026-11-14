import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Campo, ErroFormulario, useFormulario } from '../components/Formulario.jsx';
import { api } from '../api.js';
import { useSessao } from '../sessao.jsx';

// Só aceita caminhos internos em ?voltar=, para não virar um redirecionador aberto.
export function destinoSeguro(voltar) {
  return voltar && voltar.startsWith('/') && !voltar.startsWith('//') ? voltar : '/minha-area';
}

function validar({ email, senha }) {
  const erros = {};
  if (!email.trim()) erros.email = 'E-mail é obrigatório.';
  if (!senha) erros.senha = 'Senha é obrigatória.';
  return erros;
}

// PBI-11: login do organizador por e-mail e senha.
export default function EntrarPage() {
  const [parametros] = useSearchParams();
  const destino = destinoSeguro(parametros.get('voltar'));
  const navegar = useNavigate();
  const { logado, iniciar } = useSessao();

  const { erros, erroGeral, enviando, atributos, enviar } = useFormulario(
    { email: '', senha: '' },
    {
      validar,
      aoEnviar: async ({ email, senha }) => {
        iniciar(await api.entrar(email, senha));
        navegar(destino, { replace: true });
      },
    },
  );

  if (logado) return <Navigate to={destino} replace />;

  return (
    <section className="conta">
      <div className="titulo-pagina">
        <h1>Entrar</h1>
        <p>Área do organizador: publique e gerencie suas aulas.</p>
      </div>
      <form className="formulario" onSubmit={enviar} noValidate>
        <fieldset>
          <legend>Seus dados de acesso</legend>
          <Campo id="email" rotulo="E-mail" erro={erros.email}>
            <input type="email" autoComplete="email" {...atributos('email')} />
          </Campo>
          <Campo id="senha" rotulo="Senha" erro={erros.senha}>
            <input type="password" autoComplete="current-password" {...atributos('senha')} />
          </Campo>
          <Link to="/recuperar-senha" className="link-editar">Esqueci minha senha</Link>
        </fieldset>
        <ErroFormulario>{erroGeral}</ErroFormulario>
        <button type="submit" className="botao" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="texto-suave">
        Ainda não tem conta?{' '}
        <Link to={`/criar-conta${parametros.get('voltar') ? `?voltar=${encodeURIComponent(destino)}` : ''}`}>
          Crie sua conta de organizador
        </Link>
      </p>
    </section>
  );
}
