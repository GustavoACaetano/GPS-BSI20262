import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PainelBalneabilidade, TagBalneabilidade } from './Balneabilidade.jsx';

const boletim = (extras = {}) => ({
  id: 1,
  status: 'PROPRIA',
  dataColeta: '2026-10-19',
  dataBoletim: '2026-10-20T13:00:00.000Z',
  fonte: 'IEMA',
  diasDesdeBoletim: 1,
  pendenteAtualizacao: false,
  ...extras,
});

describe('TagBalneabilidade', () => {
  test('sem boletim mostra tag neutra', () => {
    render(<TagBalneabilidade boletim={null} />);
    expect(screen.getByText('Sem boletim disponível')).toHaveClass('tag--neutra');
  });

  test('praia própria mostra tag verde', () => {
    render(<TagBalneabilidade boletim={boletim()} />);
    expect(screen.getByText('Própria para banho')).toHaveClass('tag--propria');
    expect(screen.queryByText('Pendente de atualização')).not.toBeInTheDocument();
  });

  test('praia imprópria mostra tag vermelha', () => {
    render(<TagBalneabilidade boletim={boletim({ status: 'IMPROPRIA' })} />);
    expect(screen.getByText('Imprópria para banho')).toHaveClass('tag--impropria');
  });

  test('boletim antigo mostra alerta de pendência', () => {
    render(<TagBalneabilidade boletim={boletim({ pendenteAtualizacao: true })} />);
    expect(screen.getByText('Pendente de atualização')).toHaveClass('tag--alerta');
  });
});

describe('PainelBalneabilidade', () => {
  test('exibe boletim, data da coleta e órgão emissor', () => {
    const { container } = render(<PainelBalneabilidade boletim={boletim()} />);
    expect(container.firstChild).toHaveClass('painel--propria');
    expect(screen.getByText('19/10/2026')).toBeInTheDocument();
    expect(screen.getByText('20/10/2026, 10:00')).toBeInTheDocument();
    expect(screen.getByText('IEMA')).toBeInTheDocument();
  });

  test('sem boletim exibe aviso e estilo neutro', () => {
    const { container } = render(<PainelBalneabilidade boletim={null} />);
    expect(container.firstChild).toHaveClass('painel--neutro');
    expect(screen.getByText(/Ainda não há boletim oficial/)).toBeInTheDocument();
  });

  test('boletim pendente informa há quantos dias foi emitido', () => {
    render(<PainelBalneabilidade boletim={boletim({ pendenteAtualizacao: true, diasDesdeBoletim: 12 })} />);
    expect(screen.getByText(/O último boletim tem 12 dias/)).toBeInTheDocument();
  });
});
