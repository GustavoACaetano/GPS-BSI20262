import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Campo, ErroFormulario, erroSenha, useFormulario } from '../components/Formulario.jsx';
import { api } from '../api.js';

function validar({ novaSenha, confirmacao }) {
  const problema = erroSenha(novaSenha);
  if (problema) return { novaSenha: problema };
  if (novaSenha !== confirmacao) return { confirmacao: 'As senhas não conferem.' };
  return {};
}

// PBI-11: criação da nova senha a partir do link recebido por e-mail.
export default function RedefinirSenhaPage() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token') || '';
  const [concluido, setConcluido] = useState(false);

  const { erros, erroGeral, enviando, atributos, enviar } = useFormulario(
    { novaSenha: '', confirmacao: '' },
    {
      validar,
      aoEnviar: async ({ novaSenha }) => {
        await api.redefinirSenha(token, novaSenha);
        setConcluido(true);
      },
    },
  );

  if (!token) {
    return (
      <section className="conta">
        <p className="estado estado--erro" role="alert">Link de redefinição inválido ou expirado.</p>
        <Link to="/recuperar-senha" className="botao">Pedir um novo link</Link>
      </section>
    );
  }

  return (
    <section className="conta">
      <div className="titulo-pagina">
        <h1>Criar nova senha</h1>
      </div>
      {concluido ? (
        <div className="painel painel--propria" role="status">
          <p>Senha redefinida! Por segurança, você foi desconectado de todos os aparelhos.</p>
          <Link to="/entrar" className="botao">Entrar com a nova senha</Link>
        </div>
      ) : (
        <form className="formulario" onSubmit={enviar} noValidate>
          <fieldset>
            <legend>Nova senha</legend>
            <Campo id="novaSenha" rotulo="Nova senha" erro={erros.novaSenha} dica="Mínimo de 8 caracteres, com letras e números.">
              <input type="password" autoComplete="new-password" {...atributos('novaSenha')} />
            </Campo>
            <Campo id="confirmacao" rotulo="Confirme a nova senha" erro={erros.confirmacao}>
              <input type="password" autoComplete="new-password" {...atributos('confirmacao')} />
            </Campo>
          </fieldset>
          <ErroFormulario>{erroGeral}</ErroFormulario>
          {erroGeral && /expirado/.test(erroGeral) && (
            <Link to="/recuperar-senha">Pedir um novo link</Link>
          )}
          <button type="submit" className="botao" disabled={enviando}>
            {enviando ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>
      )}
    </section>
  );
}
