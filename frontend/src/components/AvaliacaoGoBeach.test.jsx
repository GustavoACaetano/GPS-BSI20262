import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AvaliacaoGoBeach, { jaAvaliou } from './AvaliacaoGoBeach.jsx';
import RodapeAvaliacao from './RodapeAvaliacao.jsx';
import FormularioInscricao from './FormularioInscricao.jsx';
import { api, ErroApi } from '../api.js';

// PBI-14: avaliação da plataforma (1 a 5 estrelas).

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

const estrela = (n) => screen.getByRole('radio', { name: new RegExp(`^${n} estrelas?:`) });

describe('AvaliacaoGoBeach', () => {
  test('envia a nota e a sugestão, agradece e lembra que avaliou', async () => {
    const avaliar = vi.spyOn(api, 'avaliar').mockResolvedValue({ id: 1, mensagem: 'Obrigado pela avaliação!' });
    render(<AvaliacaoGoBeach origem="/explorar" />);

    fireEvent.click(estrela(4));
    fireEvent.change(screen.getByLabelText(/Sugestões de melhoria/), { target: { value: '  Mais praias de Guarapari ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }));

    expect(await screen.findByText('Obrigado pela avaliação!')).toBeInTheDocument();
    expect(avaliar).toHaveBeenCalledWith({ nota: 4, comentario: 'Mais praias de Guarapari', pagina: '/explorar' });
    expect(jaAvaliou()).toBe(true);
  });

  test('as 5 estrelas são opções acessíveis com descrição', () => {
    render(<AvaliacaoGoBeach origem="/" />);

    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(estrela(1)).toHaveAccessibleName('1 estrela: Nada útil');
    expect(estrela(5)).toHaveAccessibleName('5 estrelas: Muito útil');
    fireEvent.click(estrela(3));
    expect(estrela(3)).toBeChecked();
    expect(screen.getByText('Mais ou menos')).toBeInTheDocument();
  });

  test('não envia sem escolher as estrelas', () => {
    const avaliar = vi.spyOn(api, 'avaliar');
    render(<AvaliacaoGoBeach origem="/" />);

    fireEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }));

    expect(screen.getByText('Escolha de 1 a 5 estrelas.')).toBeInTheDocument();
    expect(avaliar).not.toHaveBeenCalled();
  });

  test('mostra o erro da API (ex.: muitas tentativas)', async () => {
    vi.spyOn(api, 'avaliar').mockRejectedValue(new ErroApi('Muitas tentativas. Aguarde alguns minutos e tente de novo.', 429));
    render(<AvaliacaoGoBeach origem="/" />);

    fireEvent.click(estrela(5));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas');
    expect(jaAvaliou()).toBe(false);
  });

  test('quem já avaliou vê um agradecimento; o convite some', () => {
    localStorage.setItem('gobeach:avaliou', '2026-11-14T15:00:00.000Z');

    const { unmount } = render(<AvaliacaoGoBeach origem="/" />);
    expect(screen.getByText(/Você já avaliou o GoBeach/)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    unmount();

    const { container } = render(<AvaliacaoGoBeach origem="inscricao" convite />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('modal do rodapé', () => {
  const abrirRodape = () =>
    render(
      <MemoryRouter initialEntries={['/praias/3']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RodapeAvaliacao />
      </MemoryRouter>,
    );

  test('o link abre o modal, que registra a página de origem e fecha pelo X', async () => {
    const avaliar = vi.spyOn(api, 'avaliar').mockResolvedValue({ id: 1, mensagem: 'Obrigado!' });
    abrirRodape();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); // fechado = fora da árvore acessível
    fireEvent.click(screen.getByRole('button', { name: '★ Avaliar o GoBeach' }));
    const modal = screen.getByRole('dialog', { name: 'Avaliar o GoBeach' });
    expect(modal).toHaveAttribute('open');

    fireEvent.click(estrela(5));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }));
    expect(await screen.findByText('Obrigado!')).toBeInTheDocument();
    expect(avaliar).toHaveBeenCalledWith({ nota: 5, comentario: '', pagina: '/praias/3' });

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(modal).not.toHaveAttribute('open');
    expect(screen.queryByText('Obrigado!')).not.toBeInTheDocument();
  });

  test('clicar no fundo escurecido fecha; clicar dentro da caixa não', () => {
    abrirRodape();
    fireEvent.click(screen.getByRole('button', { name: '★ Avaliar o GoBeach' }));
    const modal = screen.getByRole('dialog');

    fireEvent.click(screen.getByRole('heading', { name: 'Avaliar o GoBeach' }));
    expect(modal).toHaveAttribute('open');

    fireEvent.click(modal); // o alvo é o próprio <dialog>: área do fundo
    expect(modal).not.toHaveAttribute('open');
  });

  test('fechar com Esc (evento "close" do navegador) sincroniza o estado', () => {
    abrirRodape();
    fireEvent.click(screen.getByRole('button', { name: '★ Avaliar o GoBeach' }));
    const modal = screen.getByRole('dialog');

    modal.close(); // o que o navegador faz ao apertar Esc
    expect(modal).not.toHaveAttribute('open');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: '★ Avaliar o GoBeach' }));
    expect(modal).toHaveAttribute('open');
  });

  test('ao reabrir depois de avaliar, mostra que já avaliou', async () => {
    vi.spyOn(api, 'avaliar').mockResolvedValue({ id: 1, mensagem: 'Obrigado!' });
    abrirRodape();
    fireEvent.click(screen.getByRole('button', { name: '★ Avaliar o GoBeach' }));
    fireEvent.click(estrela(4));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }));
    await screen.findByText('Obrigado!');

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    fireEvent.click(screen.getByRole('button', { name: '★ Avaliar o GoBeach' }));

    expect(screen.getByText(/Você já avaliou o GoBeach/)).toBeInTheDocument();
  });
});

describe('convite após a inscrição', () => {
  const evento = {
    id: 7, tipo: 'EVENTO', status: 'ATIVO', dataInicio: new Date(Date.now() + 864e5).toISOString(),
    limiteVagas: null, interessados: 3,
  };

  async function inscrever() {
    vi.spyOn(api, 'inscrever').mockResolvedValue({
      inscricao: { id: 1, nome: 'Bia', criadoEm: '2026-11-14T15:00:00.000Z' }, interessados: 4, vagasRestantes: null,
    });
    render(<FormularioInscricao atividade={evento} />);
    fireEvent.change(screen.getByLabelText(/^Seu nome/), { target: { value: 'Bia' } });
    fireEvent.change(screen.getByLabelText(/^E-mail ou WhatsApp/), { target: { value: 'bia@exemplo.com' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Autorizo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Inscrever-se' }));
    await screen.findByRole('heading', { name: 'Inscrição confirmada!' });
  }

  test('a confirmação da inscrição convida a avaliar', async () => {
    await inscrever();

    expect(screen.getByText('Gostou da experiência? Conte para a gente.')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  test('quem já avaliou não recebe o convite', async () => {
    localStorage.setItem('gobeach:avaliou', '2026-11-14T15:00:00.000Z');
    await inscrever();

    expect(screen.queryByText('Gostou da experiência? Conte para a gente.')).not.toBeInTheDocument();
  });
});
