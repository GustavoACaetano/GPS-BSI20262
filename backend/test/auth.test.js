import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, mockarBanco, linhas, sessaoDe, AUTH } from './helpers.js';
import { correio } from '../src/email.js';
import { limparLimites } from '../src/limitador.js';
import { conferirSenha, gerarHashSenha, hashToken } from '../src/seguranca.js';

// PBI-11: Autenticação e Perfil do Organizador

let api;
let hashSenha;
before(async () => {
  api = await iniciarServidor();
  hashSenha = await gerarHashSenha('senha1234');
});
after(() => api.fechar());
afterEach(() => {
  mock.restoreAll();
  limparLimites();
});

const ORGANIZADOR = { id: 5, nome: 'Ana Lima', email: 'ana@exemplo.com', telefone: '27 9999' };
const erroUnico = () => Object.assign(new Error('dup'), { code: '23505' });

// --- seguranca.js --------------------------------------------------------------

test('senhas são guardadas com scrypt e salt aleatório', async () => {
  const a = await gerarHashSenha('senha1234');
  const b = await gerarHashSenha('senha1234');

  assert.match(a, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.notEqual(a, b);
  assert.equal(await conferirSenha('senha1234', a), true);
  assert.equal(await conferirSenha('outra123', a), false);
  assert.equal(await conferirSenha('senha1234', null), false);
  assert.equal(await conferirSenha('senha1234', 'lixo'), false);
});

// --- Cadastro ------------------------------------------------------------------

test('POST /api/auth/cadastro cria a conta e já abre uma sessão', async () => {
  const consulta = mockarBanco(linhas([ORGANIZADOR]), linhas([]));

  const { status, corpo } = await api.post('/api/auth/cadastro', {
    nome: ' Ana Lima ',
    email: 'Ana@Exemplo.com',
    senha: 'senha1234',
    telefone: '27 9999',
  });

  assert.equal(status, 201);
  assert.match(corpo.token, /^[0-9a-f]{64}$/);
  assert.deepEqual(corpo.organizador, ORGANIZADOR);

  const [, parametros] = consulta.mock.calls[0].arguments;
  assert.deepEqual(parametros.slice(0, 3), ['Ana Lima', 'ana@exemplo.com', '27 9999']);
  assert.equal(await conferirSenha('senha1234', parametros[3]), true);
  // A sessão guarda só o hash do token entregue ao cliente.
  assert.equal(consulta.mock.calls[1].arguments[1][0], hashToken(corpo.token));
});

test('POST /api/auth/cadastro valida nome, e-mail e força da senha', async () => {
  const consulta = mockarBanco();

  const { status, corpo } = await api.post('/api/auth/cadastro', { nome: '', email: 'ana@', senha: 'abcdefgh' });

  assert.equal(status, 400);
  assert.equal(corpo.campos.nome, 'Nome é obrigatório.');
  assert.equal(corpo.campos.email, 'Informe um e-mail válido.');
  assert.equal(corpo.campos.senha, 'A senha deve ter letras e números.');
  assert.equal(consulta.mock.callCount(), 0);
});

test('POST /api/auth/cadastro recusa senha curta', async () => {
  mockarBanco();

  const { corpo } = await api.post('/api/auth/cadastro', { nome: 'Ana', email: 'ana@exemplo.com', senha: 'a1' });

  assert.match(corpo.campos.senha, /pelo menos 8/);
});

test('POST /api/auth/cadastro avisa quando o e-mail já tem conta', async () => {
  mockarBanco(erroUnico());

  const { status, corpo } = await api.post('/api/auth/cadastro', {
    nome: 'Ana', email: 'ana@exemplo.com', senha: 'senha1234',
  });

  assert.equal(status, 409);
  assert.match(corpo.campos.email, /Já existe/);
});

// --- Login / logout ---------------------------------------------------------------

test('POST /api/auth/login entra com e-mail e senha corretos', async () => {
  const consulta = mockarBanco(linhas([{ ...ORGANIZADOR, senha_hash: hashSenha }]), linhas([]));

  const { status, corpo } = await api.post('/api/auth/login', { email: ' ANA@exemplo.com ', senha: 'senha1234' });

  assert.equal(status, 200);
  assert.match(corpo.token, /^[0-9a-f]{64}$/);
  assert.deepEqual(corpo.organizador, ORGANIZADOR);
  assert.equal(corpo.organizador.senha_hash, undefined);
  assert.deepEqual(consulta.mock.calls[0].arguments[1], ['ana@exemplo.com']);
});

test('POST /api/auth/login responde igual para senha errada e e-mail inexistente', async () => {
  mockarBanco(linhas([{ ...ORGANIZADOR, senha_hash: hashSenha }]));
  const senhaErrada = await api.post('/api/auth/login', { email: 'ana@exemplo.com', senha: 'errada123' });

  mock.restoreAll();
  mockarBanco(linhas([]));
  const semConta = await api.post('/api/auth/login', { email: 'ninguem@exemplo.com', senha: 'senha1234' });

  assert.equal(senhaErrada.status, 401);
  assert.equal(semConta.status, 401);
  assert.equal(senhaErrada.corpo.erro, semConta.corpo.erro);
});

test('POST /api/auth/login valida os campos', async () => {
  mockarBanco();

  const { status, corpo } = await api.post('/api/auth/login', { email: '', senha: '' });

  assert.equal(status, 400);
  assert.ok(corpo.campos.email);
  assert.ok(corpo.campos.senha);
});

test('POST /api/auth/login bloqueia após muitas tentativas', async () => {
  mockarBanco();
  let ultima;
  for (let i = 0; i < 11; i += 1) {
    ultima = await api.post('/api/auth/login', { email: '', senha: '' });
  }

  assert.equal(ultima.status, 429);
});

test('POST /api/auth/logout apaga a sessão atual', async () => {
  const consulta = mockarBanco(sessaoDe(ORGANIZADOR), linhas([]));

  const { status } = await api.post('/api/auth/logout', undefined, AUTH);

  assert.equal(status, 204);
  const [sql, parametros] = consulta.mock.calls[1].arguments;
  assert.match(sql, /DELETE FROM sessao/);
  assert.deepEqual(parametros, [hashToken('token-de-teste')]);
});

// --- Perfil ------------------------------------------------------------------------

test('GET /api/auth/perfil devolve o organizador logado', async () => {
  const consulta = mockarBanco(sessaoDe(ORGANIZADOR));

  const { status, corpo } = await api.get('/api/auth/perfil', AUTH);

  assert.equal(status, 200);
  assert.deepEqual(corpo, ORGANIZADOR);
  const [sql, parametros] = consulta.mock.calls[0].arguments;
  assert.match(sql, /expira_em > NOW\(\)/);
  assert.deepEqual(parametros, [hashToken('token-de-teste')]);
});

test('GET /api/auth/perfil exige cabeçalho Bearer', async () => {
  mockarBanco();

  const semToken = await api.get('/api/auth/perfil');
  const outroEsquema = await api.get('/api/auth/perfil', { Authorization: 'Basic abc' });

  assert.equal(semToken.status, 401);
  assert.equal(outroEsquema.status, 401);
});

test('PUT /api/auth/perfil atualiza nome e telefone', async () => {
  const atualizado = { ...ORGANIZADOR, nome: 'Ana L.', telefone: null };
  const consulta = mockarBanco(sessaoDe(ORGANIZADOR), linhas([atualizado]));

  const { status, corpo } = await api.put('/api/auth/perfil', { nome: 'Ana L.', telefone: '' }, AUTH);

  assert.equal(status, 200);
  assert.deepEqual(corpo, atualizado);
  assert.deepEqual(consulta.mock.calls[1].arguments[1], ['Ana L.', null, 5]);
});

test('PUT /api/auth/perfil valida o nome', async () => {
  mockarBanco(sessaoDe(ORGANIZADOR));

  const { status, corpo } = await api.put('/api/auth/perfil', { nome: ' ' }, AUTH);

  assert.equal(status, 400);
  assert.ok(corpo.campos.nome);
});

test('PUT /api/auth/senha troca a senha e encerra as outras sessões', async () => {
  const consulta = mockarBanco(sessaoDe(ORGANIZADOR), linhas([{ senha_hash: hashSenha }]), linhas([]));

  const { status } = await api.put('/api/auth/senha', { senhaAtual: 'senha1234', novaSenha: 'nova12345' }, AUTH);

  assert.equal(status, 204);
  const [sql, parametros] = consulta.mock.calls[2].arguments;
  assert.match(sql, /DELETE FROM sessao/);
  assert.equal(await conferirSenha('nova12345', parametros[0]), true);
  assert.deepEqual(parametros.slice(1), [5, hashToken('token-de-teste')]);
});

test('PUT /api/auth/senha exige a senha atual correta', async () => {
  mockarBanco(sessaoDe(ORGANIZADOR), linhas([{ senha_hash: hashSenha }]));

  const { status, corpo } = await api.put('/api/auth/senha', { senhaAtual: 'errada123', novaSenha: 'nova12345' }, AUTH);

  assert.equal(status, 400);
  assert.equal(corpo.campos.senhaAtual, 'Senha atual incorreta.');
});

// --- Recuperação de senha ---------------------------------------------------------

test('POST /api/auth/recuperar-senha envia e-mail com link de uso único', async () => {
  const enviar = mock.method(correio, 'enviar', async () => {});
  const consulta = mockarBanco(linhas([{ id: 5, nome: 'Ana Lima' }]), linhas([]));

  const { status, corpo } = await api.post('/api/auth/recuperar-senha', { email: 'ana@exemplo.com' });

  assert.equal(status, 202);
  assert.match(corpo.mensagem, /Se houver uma conta/);
  assert.equal(enviar.mock.callCount(), 1);
  const email = enviar.mock.calls[0].arguments[0];
  assert.equal(email.para, 'ana@exemplo.com');
  const [, token] = email.texto.match(/redefinir-senha\?token=([0-9a-f]{64})/);
  // O banco guarda só o hash do token enviado.
  assert.deepEqual(consulta.mock.calls[1].arguments[1], [hashToken(token), 5, 60]);
});

test('POST /api/auth/recuperar-senha não revela se o e-mail existe', async () => {
  const enviar = mock.method(correio, 'enviar', async () => {});
  mockarBanco(linhas([]));

  const { status, corpo } = await api.post('/api/auth/recuperar-senha', { email: 'ninguem@exemplo.com' });

  assert.equal(status, 202);
  assert.match(corpo.mensagem, /Se houver uma conta/);
  assert.equal(enviar.mock.callCount(), 0);
});

test('POST /api/auth/recuperar-senha responde normalmente se o e-mail falhar', async () => {
  mock.method(console, 'error', () => {});
  mock.method(correio, 'enviar', async () => {
    throw new Error('SMTP fora do ar');
  });
  mockarBanco(linhas([{ id: 5, nome: 'Ana Lima' }]), linhas([]));

  const { status } = await api.post('/api/auth/recuperar-senha', { email: 'ana@exemplo.com' });

  assert.equal(status, 202);
});

test('POST /api/auth/redefinir-senha troca a senha com token válido', async () => {
  const consulta = mockarBanco(linhas([{ id: 5 }]));

  const { status } = await api.post('/api/auth/redefinir-senha', { token: 'abc', novaSenha: 'nova12345' });

  assert.equal(status, 200);
  const [sql, parametros] = consulta.mock.calls[0].arguments;
  assert.match(sql, /usado_em IS NULL AND expira_em > NOW\(\)/);
  assert.match(sql, /DELETE FROM sessao/);
  assert.equal(parametros[0], hashToken('abc'));
  assert.equal(await conferirSenha('nova12345', parametros[1]), true);
});

test('POST /api/auth/redefinir-senha recusa token usado, expirado ou ausente', async () => {
  mockarBanco(linhas([]));
  const usado = await api.post('/api/auth/redefinir-senha', { token: 'abc', novaSenha: 'nova12345' });
  const ausente = await api.post('/api/auth/redefinir-senha', { novaSenha: 'nova12345' });

  assert.equal(usado.status, 400);
  assert.match(usado.corpo.erro, /inválido ou expirado/);
  assert.equal(ausente.status, 400);
});

test('POST /api/auth/redefinir-senha valida a nova senha', async () => {
  const consulta = mockarBanco();

  const { status, corpo } = await api.post('/api/auth/redefinir-senha', { token: 'abc', novaSenha: '123' });

  assert.equal(status, 400);
  assert.ok(corpo.campos.novaSenha);
  assert.equal(consulta.mock.callCount(), 0);
});
