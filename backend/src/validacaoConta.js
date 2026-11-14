// PBI-11: validação dos dados de conta do organizador.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

export function validarEmail(valor, campos) {
  const email = texto(valor).toLowerCase();
  if (!email) campos.email = 'E-mail é obrigatório.';
  else if (email.length > 254 || !EMAIL.test(email)) campos.email = 'Informe um e-mail válido.';
  return email;
}

export function validarSenha(valor, campos, campo = 'senha') {
  const senha = typeof valor === 'string' ? valor : '';
  if (senha.length < 8) campos[campo] = 'A senha deve ter pelo menos 8 caracteres.';
  else if (senha.length > 128) campos[campo] = 'A senha deve ter no máximo 128 caracteres.';
  else if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    campos[campo] = 'A senha deve ter letras e números.';
  }
  return senha;
}

export function validarPerfil(corpo = {}, campos = {}) {
  const nome = texto(corpo.nome);
  if (!nome) campos.nome = 'Nome é obrigatório.';
  else if (nome.length > 120) campos.nome = 'Nome deve ter no máximo 120 caracteres.';

  const telefone = texto(corpo.telefone);
  if (telefone.length > 40) campos.telefone = 'Telefone deve ter no máximo 40 caracteres.';

  return { nome, telefone: telefone || null };
}

export function validarCadastro(corpo = {}) {
  const campos = {};
  const perfil = validarPerfil(corpo, campos);
  const email = validarEmail(corpo.email, campos);
  const senha = validarSenha(corpo.senha, campos);
  if (Object.keys(campos).length > 0) return { campos };
  return { dados: { ...perfil, email, senha } };
}
