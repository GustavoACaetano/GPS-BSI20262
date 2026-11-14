import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Campo, ErroFormulario, useFormulario } from '../components/Formulario.jsx';
import { api } from '../api.js';

// PBI-11: pedido do link de redefinição de senha por e-mail.
export default function RecuperarSenhaPage() {
  const [mensagem, setMensagem] = useState(null);
  const { erros, erroGeral, enviando, atributos, enviar } = useFormulario(
    { email: '' },
    {
      validar: ({ email }) => (email.trim() ? {} : { email: 'E-mail é obrigatório.' }),
      aoEnviar: async ({ email }) => setMensagem((await api.recuperarSenha(email)).mensagem),
    },
  );

  return (
    <section className="conta">
      <Link to="/entrar" className="voltar">← Voltar para o login</Link>
      <div className="titulo-pagina">
        <h1>Recuperar senha</h1>
        <p>Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
      </div>
      {mensagem ? (
        <div className="painel painel--propria" role="status">
          <p>{mensagem}</p>
          <p className="texto-suave">O link vale por 60 minutos e só pode ser usado uma vez. Confira também a caixa de spam.</p>
        </div>
      ) : (
        <form className="formulario" onSubmit={enviar} noValidate>
          <fieldset>
            <legend>Conta</legend>
            <Campo id="email" rotulo="E-mail" erro={erros.email}>
              <input type="email" autoComplete="email" {...atributos('email')} />
            </Campo>
          </fieldset>
          <ErroFormulario>{erroGeral}</ErroFormulario>
          <button type="submit" className="botao" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar link'}
          </button>
        </form>
      )}
    </section>
  );
}
