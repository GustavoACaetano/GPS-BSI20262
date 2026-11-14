# Gestão do projeto

Esta pasta reúne o acompanhamento do andamento do projeto a partir do quadro do Trello: quanto do backlog já foi concluído e uma estimativa de quando o restante deve ficar pronto.

## Conteúdo

| Arquivo / pasta      | O que é                                                                 |
|----------------------|-------------------------------------------------------------------------|
| `quadro.json`        | Exportação do quadro do Trello usada como fonte dos dados.              |
| `gerar-relatorio.js` | Script que lê o `quadro.json` e gera o relatório e o gráfico.           |
| `grafico.js`         | Módulo usado pelo script para montar o gráfico em HTML.                 |
| `relatorios/`        | Saídas geradas, por data: `relatorio-DD-MM-AAAA.txt` e `grafico-DD-MM-AAAA.html`. |

## Como gerar um relatório

Requisito: [Node.js](https://nodejs.org/) instalado.

1. **Atualize o `quadro.json`.** Abra o quadro no Trello, acrescente `.json` ao final da URL (por exemplo, `https://trello.com/b/<id>/<nome>.json`) e salve o conteúdo da página como `gestao/quadro.json`.
2. **Rode o script** a partir da raiz do repositório:

   ```bash
   node gestao/gerar-relatorio.js
   ```

O relatório aparece no terminal e é salvo em `gestao/relatorios/relatorio-DD-MM-AAAA.txt`, com a data do dia. Junto com ele é gerado `gestao/relatorios/grafico-DD-MM-AAAA.html`, que abre em qualquer navegador. Gerar de novo no mesmo dia sobrescreve os arquivos daquele dia.

### Opções

```bash
node gestao/gerar-relatorio.js [quadro.json] [AAAA-MM-DD] [--semanas=N] [--api=URL]
```

| Opção          | Efeito                                                                                          |
|----------------|-------------------------------------------------------------------------------------------------|
| `quadro.json`  | Usa outro arquivo exportado no lugar de `gestao/quadro.json`.                                    |
| `AAAA-MM-DD`   | Prazo da entrega. O relatório informa se o prazo é viável no ritmo atual.                       |
| `--semanas=N`  | Número de semanas efetivamente trabalhadas. Sem essa opção, contam as semanas em que algum card foi concluído. |
| `--api=URL`    | Endereço da API do GoBeach (ex.: `http://localhost:3000`). Acrescenta a seção "Metas do MVP", lida de `/api/metricas`: inscrições (meta 100), atividades publicadas (meta 30) e satisfação (meta de 80% de notas 4 e 5, PBI-14). Se a API não responder, o relatório sai mesmo assim, com um aviso. |

Exemplo, com prazo em 10/12/2026 e 2 semanas trabalhadas:

```bash
node gestao/gerar-relatorio.js 2026-12-10 --semanas=2
```

## O que o relatório mostra

- **Conclusão por cards:** cards na lista "Concluído" sobre o total de cards ativos do quadro.
- **Distribuição por lista:** quantos cards há em cada coluna do quadro.
- **Conclusão por checklist:** itens de checklist marcados sobre o total, somando todos os cards.
- **Estimativa:**
  - **Ritmo:** cards concluídos por semana trabalhada.
  - **Semanas restantes:** cards restantes divididos pelo ritmo.
  - **Data prevista de término:** considera que a equipe trabalha toda semana a partir de hoje.
  - **Viabilidade do prazo:** só aparece quando o prazo é informado.

### Gráfico

O HTML traz um gráfico *burn-up*:

- **Linha contínua:** cards concluídos acumulados ao longo do tempo.
- **Linha tracejada:** estimativa de hoje até o término previsto.
- **Linha pontilhada:** total de cards do escopo.
- **Linha vertical:** prazo, quando informado.

Passe o mouse sobre o gráfico para ver o valor de cada dia. Os dados também podem ser vistos em tabela, no link abaixo do gráfico.

## Limitações da estimativa

- Todos os cards têm o mesmo peso, independentemente do tamanho do PBI.
- Com poucas semanas de histórico, a previsão é só uma ordem de grandeza. Ela melhora a cada sprint concluída.
- A data de conclusão de cada card vem do histórico de ações do export, que guarda apenas as ações mais recentes. Quando a movimentação não aparece, o script usa a última atividade do card.
- Novos cards adicionados ao backlog empurram a previsão para mais tarde.
- A lista final é identificada pelo nome contendo "Concluido" (sem diferenciar acentos, maiúsculas ou emojis). Se a lista for renomeada, ajuste `LISTA_CONCLUIDO` no script.
