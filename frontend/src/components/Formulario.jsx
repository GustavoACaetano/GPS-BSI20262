import { useState } from 'react';

// Campo rotulado com dica e mensagem de erro acessível.
export function Campo({ id, rotulo, erro, obrigatorio, children, dica }) {
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

// Estado de um formulário simples: valores, erros por campo (do navegador ou da API),
// erro geral e envio em andamento.
export function useFormulario(inicial, { validar = () => ({}), aoEnviar }) {
  const [valores, setValores] = useState(inicial);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const atributos = (campo) => ({
    id: campo,
    name: campo,
    value: valores[campo],
    onChange: (evento) => {
      setValores((atual) => ({ ...atual, [campo]: evento.target.value }));
      setErros((atual) => ({ ...atual, [campo]: undefined }));
    },
    'aria-invalid': Boolean(erros[campo]),
    'aria-describedby': erros[campo] ? `${campo}-erro` : undefined,
  });

  const enviar = async (evento) => {
    evento.preventDefault();
    setErroGeral(null);
    const encontrados = validar(valores);
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) {
      setErroGeral('Revise os campos destacados.');
      return;
    }
    setEnviando(true);
    try {
      await aoEnviar(valores);
    } catch (erro) {
      setErros(erro.campos || {});
      setErroGeral(erro.message);
    } finally {
      setEnviando(false);
    }
  };

  return { valores, setValores, erros, erroGeral, enviando, atributos, enviar };
}

export function ErroFormulario({ children }) {
  if (!children) return null;
  return (
    <p className="estado--erro formulario__erro" role="alert">
      {children}
    </p>
  );
}

// Regras de senha iguais às da API (PBI-11).
export function erroSenha(senha) {
  if (senha.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (senha.length > 128) return 'A senha deve ter no máximo 128 caracteres.';
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return 'A senha deve ter letras e números.';
  return null;
}
