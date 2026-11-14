import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Campo, ErroFormulario, erroSenha, useFormulario } from '../components/Formulario.jsx';
import { api } from '../api.js';
import { useSessao } from '../sessao.jsx';
import { destinoSeguro } from './EntrarPage.jsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarConta({ nome, email, senha, confirmacao }) {
  const erros = {};
  if (!nome.trim()) erros.nome = 'Nome é obrigatório.';
  if (!email.trim()) erros.email = 'E-mail é obrigatório.';
  else if (!EMAIL.test(email.trim())) erros.email = 'Informe um e-mail válido.';
  const problemaSenha = erroSenha(senha);
  if (problemaSenha) erros.senha = problemaSenha;
  else if (senha !== confirmacao) erros.confirmacao = 'As senhas não conferem.';
  return erros;
}

// PBI-11: cadastro de organizador (instrutor, organizador de evento ou ONG).
export default function CriarContaPage() {
  const [parametros] = useSearchParams();
  const destino = destinoSeguro(parametros.get('voltar'));
  const navegar = useNavigate();
  const { logado, iniciar } = useSessao();

  const { erros, erroGeral, enviando, atributos, enviar } = useFormulario(
    { nome: '', email: '', telefone: '', senha: '', confirmacao: '' },
    {
      validar: validarConta,
      aoEnviar: async ({ nome, email, telefone, senha }) => {
        iniciar(await api.criarConta({ nome, email, telefone, senha }));
        navegar(destino, { replace: true });
      },
    },
  );

  if (logado) return <Navigate to={destino} replace />;

  return (
    <section className="conta">
      <div className="titulo-pagina">
        <h1>Criar conta de organizador</h1>
        <p>Divulgue aulas na praia para moradores e turistas da Grande Vitória.</p>
      </div>
      <form className="formulario" onSubmit={enviar} noValidate>
        <fieldset>
          <legend>Perfil</legend>
          <Campo id="nome" rotulo="Nome ou escola" erro={erros.nome} obrigatorio>
            <input autoComplete="name" maxLength={120} {...atributos('nome')} />
          </Campo>
          <Campo id="telefone" rotulo="Telefone / WhatsApp" erro={erros.telefone} dica="Opcional. Sugerido como contato nas suas aulas.">
            <input type="tel" autoComplete="tel" maxLength={40} {...atributos('telefone')} />
          </Campo>
        </fieldset>
        <fieldset>
          <legend>Acesso</legend>
          <Campo id="email" rotulo="E-mail" erro={erros.email} obrigatorio>
            <input type="email" autoComplete="email" maxLength={254} {...atributos('email')} />
          </Campo>
          <Campo id="senha" rotulo="Senha" erro={erros.senha} obrigatorio dica="Mínimo de 8 caracteres, com letras e números.">
            <input type="password" autoComplete="new-password" {...atributos('senha')} />
          </Campo>
          <Campo id="confirmacao" rotulo="Confirme a senha" erro={erros.confirmacao} obrigatorio>
            <input type="password" autoComplete="new-password" {...atributos('confirmacao')} />
          </Campo>
        </fieldset>
        <ErroFormulario>{erroGeral}</ErroFormulario>
        <button type="submit" className="botao" disabled={enviando}>
          {enviando ? 'Criando conta…' : 'Criar conta'}
        </button>
      </form>
      <p className="texto-suave">
        Já tem conta? <Link to="/entrar">Entrar</Link>
      </p>
    </section>
  );
}
