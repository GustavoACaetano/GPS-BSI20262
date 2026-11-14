import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FormularioInscricao, { contatoValido, situacaoInscricao, validarInscricao } from './FormularioInscricao.jsx';
import { api, ErroApi } from '../api.js';

// PBI-10: inscrição / demonstração de interesse.

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

const futuro = new Date(Date.now() + 7 * 864e5).toISOString();
const evento = (extras = {}) => ({
  id: 7, tipo: 'EVENTO', status: 'ATIVO', dataInicio: futuro, limiteVagas: 32, interessados: 30, ...extras,
});

const preencher = (rotulo, valor) =>
  fireEvent.change(screen.getByLabelText(new RegExp(`^${rotulo}`)), { target: { value: valor } });

function preencherValido() {
  preencher('Seu nome', 'Bia Souza');
  preencher('E-mail ou WhatsApp', '(27) 99999-1234');
  fireEvent.click(screen.getByRole('checkbox', { name: /Autorizo o envio/ }));
}

describe('regras', () => {
  test('contatoValido aceita e-mail ou telefone com DDD', () => {
    expect(contatoValido('bia@exemplo.com')).toBe(true);
    expect(contatoValido('(27) 99999-1234')).toBe(true);
    expect(contatoValido('+55 27 99999-1234')).toBe(true);
    expect(contatoValido('99999-1234')).toBe(false);
    expect(contatoValido('bia@')).toBe(false);
    expect(contatoValido('@bia_insta')).toBe(false);
  });

  test('validarInscricao exige nome, contato e consentimento', () => {
    expect(Object.keys(validarInscricao({ nome: '', contato: '', consentimento: false })).sort()).toEqual([
      'consentimento', 'contato', 'nome',
    ]);
  });

  test('situacaoInscricao bloqueia cancelada, encerrada e esgotada; aulas não encerram', () => {
    const passado = new Date(Date.now() - 864e5).toISOString();
    expect(situacaoInscricao(evento())).toBeNull();
    expect(situacaoInscricao(evento({ status: 'CANCELADO' }))).toMatch(/cancelada/);
    expect(situacaoInscricao(evento({ dataInicio: passado }))).toMatch(/encerradas/);
    expect(situacaoInscricao(evento({ interessados: 32 }))).toMatch(/esgotadas/);
    expect(situacaoInscricao({ id: 1, tipo: 'AULA', status: 'ATIVO', limiteVagas: null, interessados: 3 })).toBeNull();
    expect(situacaoInscricao(evento({ status: 'ADIADO' }))).toBeNull();
  });
});

describe('FormularioInscricao', () => {
  test('inscreve e mostra a confirmação com o contador atualizado', async () => {
    const inscrever = vi.spyOn(api, 'inscrever').mockResolvedValue({
      inscricao: { id: 501, nome: 'Bia Souza', criadoEm: '2026-11-14T15:00:00.000Z' },
      interessados: 31,
      vagasRestantes: 1,
    });
    const aoInscrever = vi.fn();
    render(<FormularioInscricao atividade={evento()} aoInscrever={aoInscrever} />);

    preencherValido();
    fireEvent.click(screen.getByRole('button', { name: 'Inscrever-se' }));

    expect(await screen.findByRole('heading', { name: 'Inscrição confirmada!' })).toBeInTheDocument();
    expect(screen.getByText(/Obrigado, Bia Souza!/)).toBeInTheDocument();
    expect(screen.getByText('31').closest('p')).toHaveTextContent('31 pessoas inscritas · 1 vaga restante');
    expect(inscrever).toHaveBeenCalledWith(7, { nome: 'Bia Souza', contato: '(27) 99999-1234', consentimento: true });
    expect(aoInscrever).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('gobeach:inscricoes'))).toEqual({ 7: 'Bia Souza' });
  });

  test('não envia sem consentimento e com contato inválido', async () => {
    const inscrever = vi.spyOn(api, 'inscrever');
    render(<FormularioInscricao atividade={evento()} />);

    preencher('Seu nome', 'Bia');
    preencher('E-mail ou WhatsApp', '99999-1234');
    fireEvent.click(screen.getByRole('button', { name: 'Inscrever-se' }));

    expect(await screen.findByText('Informe um e-mail válido ou um WhatsApp com DDD.')).toBeInTheDocument();
    expect(screen.getByText(/É preciso autorizar/)).toBeInTheDocument();
    expect(inscrever).not.toHaveBeenCalled();
  });

  test('inscrição duplicada aparece no campo de contato', async () => {
    vi.spyOn(api, 'inscrever').mockRejectedValue(
      new ErroApi('Este contato já está inscrito nesta atividade.', 409, {
        contato: 'Este contato já está inscrito nesta atividade.',
      }),
    );
    const aoInscrever = vi.fn();
    render(<FormularioInscricao atividade={evento()} aoInscrever={aoInscrever} />);

    preencherValido();
    fireEvent.click(screen.getByRole('button', { name: 'Inscrever-se' }));

    expect(await screen.findAllByText('Este contato já está inscrito nesta atividade.')).not.toHaveLength(0);
    expect(aoInscrever).not.toHaveBeenCalled();
  });

  test('vagas esgotadas durante o preenchimento atualizam a tela', async () => {
    vi.spyOn(api, 'inscrever').mockRejectedValue(new ErroApi('As vagas desta atividade estão esgotadas.', 409));
    const aoInscrever = vi.fn();
    render(<FormularioInscricao atividade={evento()} aoInscrever={aoInscrever} />);

    preencherValido();
    fireEvent.click(screen.getByRole('button', { name: 'Inscrever-se' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('esgotadas');
    await waitFor(() => expect(aoInscrever).toHaveBeenCalledTimes(1));
  });

  test('atividade lotada não mostra o formulário', () => {
    render(<FormularioInscricao atividade={evento({ interessados: 32 })} />);

    expect(screen.getByText('As vagas desta atividade estão esgotadas.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inscrever-se' })).not.toBeInTheDocument();
  });

  test('textos mudam para aulas e ações', () => {
    const { unmount } = render(<FormularioInscricao atividade={{ id: 1, tipo: 'AULA', status: 'ATIVO', interessados: 0 }} />);
    expect(screen.getByRole('button', { name: 'Quero participar' })).toBeInTheDocument();
    unmount();
    render(
      <FormularioInscricao atividade={{ id: 2, tipo: 'ACAO_COMUNITARIA', status: 'ATIVO', dataInicio: futuro, interessados: 0 }} />,
    );
    expect(screen.getByRole('button', { name: 'Confirmar presença' })).toBeInTheDocument();
  });

  test('lembra que a pessoa já se inscreveu neste navegador', () => {
    localStorage.setItem('gobeach:inscricoes', JSON.stringify({ 7: 'Bia Souza' }));
    render(<FormularioInscricao atividade={evento()} />);

    expect(screen.getByText(/Você já se inscreveu nesta atividade neste navegador, como Bia Souza/)).toBeInTheDocument();
  });
});
