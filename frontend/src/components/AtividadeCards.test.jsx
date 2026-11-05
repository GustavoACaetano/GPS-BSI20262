import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AcaoCard, AulaCard, EventoCard } from './AtividadeCards.jsx';
import SeloStatus from './SeloStatus.jsx';

const praia = { id: 3, nome: 'Camburi', municipio: 'Vitória' };

const renderizar = (elemento) =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {elemento}
    </MemoryRouter>,
  );

const aula = (extras = {}) => ({
  id: 1,
  status: 'ATIVO',
  titulo: 'Surf para iniciantes',
  modalidade: 'Surf',
  praia,
  diasSemana: 'Sáb e Dom',
  horaInicio: '07:00',
  horaFim: '08:30',
  instrutor: 'Ana',
  ...extras,
});

describe('SeloStatus', () => {
  test.each([
    ['ADIADO', 'Adiado', 'selo--adiado'],
    ['CANCELADO', 'Cancelado', 'selo--cancelado'],
  ])('status %s mostra selo "%s"', (status, texto, classe) => {
    render(<SeloStatus status={status} />);
    expect(screen.getByText(texto)).toHaveClass(classe);
  });

  test('status ativo não mostra selo', () => {
    const { container } = render(<SeloStatus status="ATIVO" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AulaCard', () => {
  test('mostra dados da aula e link para detalhes', () => {
    renderizar(<AulaCard aula={aula()} />);
    expect(screen.getByRole('heading', { name: 'Surf para iniciantes' })).toBeInTheDocument();
    expect(screen.getByText('07:00 – 08:30')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Camburi · Vitória' })).toHaveAttribute('href', '/praias/3');
    expect(screen.getByRole('link', { name: 'Ver Detalhes e Inscrição' })).toHaveAttribute(
      'href',
      '/atividades/1',
    );
  });

  test('na página de detalhe não repete o link', () => {
    renderizar(<AulaCard aula={aula()} detalhe />);
    expect(screen.queryByText('Ver Detalhes e Inscrição')).not.toBeInTheDocument();
  });

  test('aula cancelada fica marcada como inativa', () => {
    renderizar(<AulaCard aula={aula({ status: 'CANCELADO' })} />);
    expect(screen.getByRole('article')).toHaveClass('card--inativa');
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
  });
});

describe('EventoCard', () => {
  const evento = (extras = {}) => ({
    id: 2,
    status: 'ATIVO',
    titulo: 'Campeonato de Vôlei',
    modalidade: 'Vôlei',
    dataInicio: '2026-11-07T12:00:00.000Z',
    praia,
    localDetalhe: 'Quadra 2',
    gratuito: true,
    valorInscricao: null,
    ...extras,
  });

  test('evento gratuito mostra tag "Gratuito"', () => {
    renderizar(<EventoCard evento={evento()} />);
    expect(screen.getByText('Gratuito')).toBeInTheDocument();
  });

  test('evento pago mostra o valor da taxa', () => {
    renderizar(<EventoCard evento={evento({ gratuito: false, valorInscricao: 50 })} />);
    expect(screen.getByText(/Taxa de R\$\s50,00/)).toBeInTheDocument();
  });
});

describe('AcaoCard', () => {
  const acao = (extras = {}) => ({
    id: 3,
    status: 'ATIVO',
    titulo: 'Mutirão de limpeza',
    objetivoAmbiental: 'Retirar resíduos da areia',
    dataInicio: '2026-11-10T11:00:00.000Z',
    praia,
    pontoEncontro: 'Píer de Iemanjá',
    recomendacoes: ['Levar luvas', 'Usar protetor solar'],
    interessados: 18,
    ...extras,
  });

  test('mostra objetivo, recomendações e contador de voluntários', () => {
    renderizar(<AcaoCard acao={acao()} />);
    expect(screen.getByText('Retirar resíduos da areia')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('18').closest('p')).toHaveTextContent('18 voluntários confirmados');
  });

  test('sem recomendações não mostra a lista', () => {
    renderizar(<AcaoCard acao={acao({ recomendacoes: [] })} />);
    expect(screen.queryByText('Recomendações')).not.toBeInTheDocument();
  });
});
