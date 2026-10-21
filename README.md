# GoBeach

Plataforma que centraliza informações de praias, balneabilidade, aulas, eventos esportivos e ações comunitárias da Grande Vitória (ES).

Projeto da disciplina de Gerência de Projetos de Software (IFES — Campus Serra), grupo **Ardísia Software**.

Esta versão entrega a **Sprint 1** do [Product Backlog](docs/Product%20Backlog%20-%20GoBeach.pdf): PBI-01 a PBI-05.

## Estrutura do repositório

```text
.
├── backend/            API REST (Node.js 20 + Express)
│   ├── src/            Código da API
│   └── test/           Testes unitários (node --test)
├── database/
│   └── init/           Scripts SQL executados na criação do banco
│       ├── 01_schema.sql   Tabelas, tipos e restrições
│       └── 02_seed.sql     Carga inicial (praias, boletins, aulas, eventos, ações)
├── frontend/           Interface web (React 18 + Vite + Leaflet, servida por nginx)
├── docs/               Documentação do projeto (mini-charter, documento executivo, backlog, roadmap)
├── docker-compose.yml
└── .env.example
```

## Como rodar com Docker (recomendado)

### Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (ou Docker Engine + Docker Compose v2) **em execução**.

### Passo a passo

1. Clone o repositório e entre na pasta:

   ```bash
   git clone https://github.com/GustavoACaetano/GPS-BSI20262.git
   cd GPS-BSI20262
   ```

2. (Opcional) Para mudar portas ou credenciais, copie o arquivo de exemplo e edite:

   ```bash
   cp .env.example .env
   ```

3. Suba a aplicação:

   ```bash
   docker compose up -d --build
   ```

4. Acesse:

   | Serviço   | Endereço                          |
   |-----------|-----------------------------------|
   | Frontend  | http://localhost:8080             |
   | API       | http://localhost:3000/api/health  |
   | Banco     | `localhost:5432` (usuário/senha/banco: `gobeach`) |

   O frontend também encaminha `/api` para o backend, então `http://localhost:8080/api/praias` funciona.

### Comandos úteis

```bash
docker compose logs -f backend    # acompanhar logs da API
docker compose ps                 # status dos containers
docker compose down               # parar (mantém os dados)
docker compose down -v            # parar e apagar o banco (recria com a carga inicial no próximo up)
```

> Os scripts de `database/init` só rodam quando o volume do banco é criado. Depois de alterar o SQL, use `docker compose down -v` e suba de novo.

## Como rodar sem Docker (desenvolvimento)

Requer Node.js 20+ e um PostgreSQL 16 acessível. O jeito mais simples é subir só o banco pelo Docker:

```bash
docker compose up -d db
```

Backend (porta 3000):

```bash
cd backend
npm install
npm run dev          # usa DATABASE_URL ou postgres://gobeach:gobeach@localhost:5432/gobeach
npm test             # testes unitários
```

Frontend (porta 5173, com proxy de `/api` para `localhost:3000`):

```bash
cd frontend
npm install
npm run dev
```

## API

Todos os endpoints são de leitura; nesta sprint não há rotas de escrita, então usuários não autenticados apenas consultam.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Status da API e do banco |
| GET | `/api/praias?busca=&municipio=&pagina=&limite=` | Lista paginada de praias com o último boletim de balneabilidade |
| GET | `/api/praias/:id` | Detalhe de uma praia |
| GET | `/api/praias/:id/balneabilidade` | Boletim atual e histórico (até 10) |
| GET | `/api/atividades?tipo=AULA&ordenar=modalidade\|praia` | Aulas, ordenadas por modalidade ou praia |
| GET | `/api/atividades?tipo=EVENTO` | Próximos eventos em ordem cronológica |
| GET | `/api/atividades?tipo=ACAO_COMUNITARIA` | Próximas ações com contador de interessados |
| GET | `/api/atividades/:id` | Detalhe de uma atividade |

Todas as rotas de atividades aceitam `&praia=<id>` para filtrar por praia.

## PBIs entregues (Sprint 1)

| PBI | Onde ver | Critérios de aceite atendidos |
|-----|----------|-------------------------------|
| **PBI-01** Consultar Praias | Aba **Praias** (Mapa ou Lista) | Mapa navegável (Leaflet + OpenStreetMap) com um marcador por praia, colorido pela balneabilidade, e popup com link para a página da praia; praias de Vitória, Vila Velha, Serra e Guarapari com nome e município; card clicável leva à página da praia (foto, descrição e link de localização no mapa); lista paginada, carregada em poucos milissegundos; busca e filtro por município, com a mensagem "Nenhuma praia encontrada" quando nada é encontrado |
| **PBI-02** Balneabilidade | Cards e página da praia | Tag verde (Própria) e vermelha (Imprópria); data/hora do boletim, data da coleta e órgão emissor; alerta amarelo "Pendente de atualização" quando o boletim tem mais de 7 dias; boletins sem data de coleta ou fonte são barrados pelo banco (`NOT NULL`) e nunca exibidos pela API |
| **PBI-03** Consultar Aulas | Aba **Aulas** | Modalidade, praia, dias, horário de início/término e instrutor; ordenação por modalidade ou praia; layout responsivo; botão "Ver Detalhes e Inscrição" em cada card |
| **PBI-04** Consultar Eventos | Aba **Eventos** | Título, modalidade, local exato, data, horário e gratuito/taxa; ordem cronológica (próximos no topo); API só de leitura; selo "Adiado"/"Cancelado" conforme o status |
| **PBI-05** Consultar Ações Comunitárias | Aba **Ações** | Título, objetivo ambiental, praia, ponto de encontro e data/horário; lista de recomendações; layout responsivo pensado para telas a partir de 360px; contador de voluntários atualizado a cada 10 segundos |

A carga inicial inclui casos para demonstração: praias com boletim vencido (Meaípe, Carapebus, Praia da Sereia), uma praia sem boletim (Ilha do Boi), um evento adiado e um cancelado.

Ficam para as próximas sprints: cadastro pelo organizador (PBI-06 a 08), filtros combinados (PBI-09), formulário de inscrição (PBI-10), autenticação (PBI-11), alteração de status (PBI-12), busca textual global (PBI-13) e feedback (PBI-14).

## Documentação

- [Mini-Charter](docs/mini-charter.md)
- [Documento Executivo](docs/documento-executivo.md)
- [Product Backlog](docs/Product%20Backlog%20-%20GoBeach.pdf)
- [Roadmap Estratégico](docs/GoBeach_Strategic_Roadmap.pdf)

## Equipe

Davi Henrique Comério, Gian Lucca Decoté Paneto Neves, Gustavo Alves Caetano (gerente do projeto) e João Pedro Zamborlini Barcellos.
