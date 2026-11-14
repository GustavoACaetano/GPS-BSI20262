import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import EntrarPage, { destinoSeguro } from './EntrarPage.jsx';
import CriarContaPage, { validarConta } from './CriarContaPage.jsx';
import RecuperarSenhaPage from './RecuperarSenhaPage.jsx';
import RedefinirSenhaPage from './RedefinirSenhaPage.jsx';
import { api, ErroApi } from '../api.js';
import { RotaProtegida, useSessao } from '../sessao.jsx';
import { ORGANIZADOR, renderizar } from '../test/renderizar.jsx';

// PBI-11: telas de autenticação e perfil do organizador.

afterEach(() => vi.restoreAllMocks());

const preencher = (rotulo, valor) =>
  fireEvent.change(screen.getByLabelText(new RegExp(`^${rotulo}`)), { target: { value: valor } });

describe('destinoSeguro', () => {
  test.each([
    ['/aulas/nova', '/aulas/nova'],
    [null, '/minha-area'],
    ['//site-malicioso.com', '/minha-area'],
    ['https://site-malicioso.com', '/minha-area'],
  ])('%s -> %s', (entrada, saida) => {
    expect(destinoSeguro(entrada)).toBe(saida);
  });
});

describe('RotaProtegida', () => {
  test('sem login, manda para /entrar guardando o destino', () => {
    renderizar(<RotaProtegida><p>secreto</p></RotaProtegida>, { rota: '/aulas/nova', caminho: '/aulas/nova' });

    expect(screen.queryByText('secreto')).not.toBeInTheDocument();
    expect(screen.getByTestId('local')).toHaveTextContent('/entrar?voltar=%2Faulas%2Fnova');
  });

  test('com login, mostra a página', () => {
    renderizar(<RotaProtegida><p>secreto</p></RotaProtegida>, { organizador: ORGANIZADOR });

    expect(screen.getByText('secreto')).toBeInTheDocument();
  });
});

describe('EntrarPage', () => {
  test('entra e volta para a página pedida', async () => {
    const entrar = vi.spyOn(api, 'entrar').mockResolvedValue({ token: 'novo', organizador: ORGANIZADOR });
    renderizar(<EntrarPage />, { rota: '/entrar?voltar=%2Faulas%2Fnova', caminho: '/entrar' });

    preencher('E-mail', 'ana@exemplo.com');
    preencher('Senha', 'senha1234');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByTestId('local')).toHaveTextContent('/aulas/nova');
    expect(entrar).toHaveBeenCalledWith('ana@exemplo.com', 'senha1234');
    expect(JSON.parse(localStorage.getItem('gobeach:sessao'))).toEqual({ token: 'novo', organizador: ORGANIZADOR });
  });

  test('mostra o erro de credenciais', async () => {
    vi.spyOn(api, 'entrar').mockRejectedValue(new ErroApi('E-mail ou senha incorretos.', 401));
    renderizar(<EntrarPage />, { rota: '/entrar', caminho: '/entrar' });

    preencher('E-mail', 'ana@exemplo.com');
    preencher('Senha', 'errada');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  });

  test('valida campos vazios sem chamar a API', async () => {
    const entrar = vi.spyOn(api, 'entrar');
    renderizar(<EntrarPage />, { rota: '/entrar', caminho: '/entrar' });

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('E-mail é obrigatório.')).toBeInTheDocument();
    expect(screen.getByText('Senha é obrigatória.')).toBeInTheDocument();
    expect(entrar).not.toHaveBeenCalled();
  });
});

describe('CriarContaPage', () => {
  test('validarConta exige nome, e-mail válido, senha forte e confirmação', () => {
    expect(validarConta({ nome: '', email: 'x', senha: 'abc', confirmacao: '' })).toEqual({
      nome: 'Nome é obrigatório.',
      email: 'Informe um e-mail válido.',
      senha: 'A senha deve ter pelo menos 8 caracteres.',
    });
    expect(validarConta({ nome: 'A', email: 'a@b.co', senha: 'senha1234', confirmacao: 'outra' })).toEqual({
      confirmacao: 'As senhas não conferem.',
    });
  });

  test('cria a conta e já entra', async () => {
    const criarConta = vi.spyOn(api, 'criarConta').mockResolvedValue({ token: 'novo', organizador: ORGANIZADOR });
    renderizar(<CriarContaPage />, { rota: '/criar-conta', caminho: '/criar-conta' });

    preencher('Nome ou escola', 'Ana Lima');
    preencher('E-mail', 'ana@exemplo.com');
    preencher('Senha', 'senha1234');
    preencher('Confirme a senha', 'senha1234');
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByTestId('local')).toHaveTextContent('/minha-area');
    expect(criarConta).toHaveBeenCalledWith({
      nome: 'Ana Lima', email: 'ana@exemplo.com', telefone: '', senha: 'senha1234',
    });
  });

  test('mostra e-mail já cadastrado no campo', async () => {
    vi.spyOn(api, 'criarConta').mockRejectedValue(
      new ErroApi('Revise os campos destacados.', 409, { email: 'Já existe uma conta com este e-mail.' }),
    );
    renderizar(<CriarContaPage />, { rota: '/criar-conta', caminho: '/criar-conta' });

    preencher('Nome ou escola', 'Ana');
    preencher('E-mail', 'ana@exemplo.com');
    preencher('Senha', 'senha1234');
    preencher('Confirme a senha', 'senha1234');
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('Já existe uma conta com este e-mail.')).toBeInTheDocument();
  });
});

describe('Recuperação de senha', () => {
  test('pede o link e mostra a mensagem genérica', async () => {
    vi.spyOn(api, 'recuperarSenha').mockResolvedValue({ mensagem: 'Se houver uma conta, enviaremos um link.' });
    renderizar(<RecuperarSenhaPage />);

    preencher('E-mail', 'ana@exemplo.com');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(await screen.findByText('Se houver uma conta, enviaremos um link.')).toBeInTheDocument();
    expect(api.recuperarSenha).toHaveBeenCalledWith('ana@exemplo.com');
  });

  test('redefine a senha com o token do link', async () => {
    const redefinir = vi.spyOn(api, 'redefinirSenha').mockResolvedValue({});
    renderizar(<RedefinirSenhaPage />, { rota: '/redefinir-senha?token=abc', caminho: '/redefinir-senha' });

    preencher('Nova senha', 'nova12345');
    preencher('Confirme a nova senha', 'nova12345');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(await screen.findByText(/Senha redefinida!/)).toBeInTheDocument();
    expect(redefinir).toHaveBeenCalledWith('abc', 'nova12345');
  });

  test('link sem token oferece pedir outro', () => {
    renderizar(<RedefinirSenhaPage />, { rota: '/redefinir-senha', caminho: '/redefinir-senha' });

    expect(screen.getByRole('alert')).toHaveTextContent('inválido ou expirado');
    expect(screen.getByRole('link', { name: 'Pedir um novo link' })).toHaveAttribute('href', '/recuperar-senha');
  });
});

describe('ProvedorSessao', () => {
  function Estado() {
    const { logado, organizador } = useSessao();
    return <p>{logado ? `logado como ${organizador.nome}` : 'deslogado'}</p>;
  }

  test('sessão rejeitada pela API é encerrada', async () => {
    renderizar(<Estado />, { organizador: ORGANIZADOR });
    expect(screen.getByText('logado como Ana Lima')).toBeInTheDocument();

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ erro: 'Sessão expirada.' }) })));
    await api.listarMinhasAtividades().catch(() => {});
    vi.unstubAllGlobals();

    await waitFor(() => expect(screen.getByText('deslogado')).toBeInTheDocument());
    expect(localStorage.getItem('gobeach:sessao')).toBeNull();
  });
});
