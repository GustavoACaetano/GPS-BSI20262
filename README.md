# GoBeach

Plataforma que centraliza informações de praias, balneabilidade, aulas, eventos esportivos e ações comunitárias da Grande Vitória (ES).

Projeto da disciplina de Gerência de Projetos de Software (IFES — Campus Serra), grupo **Ardísia Software**.

Esta versão entrega a **Sprint 1** do [Product Backlog](docs/Product%20Backlog%20-%20GoBeach.pdf) (PBI-01 a PBI-05), o **PBI-06** (cadastro de aulas) e o **PBI-11** (autenticação e perfil do organizador).

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
│                       Testes ao lado dos arquivos (*.test.js / *.test.jsx, Vitest)
├── .github/workflows/  CI: testes a cada push e pull request
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
   | E-mails (Mailpit) | http://localhost:8025 (caixa de entrada dos e-mails de recuperação de senha) |

   O frontend também encaminha `/api` para o backend, então `http://localhost:8080/api/praias` funciona.

   Para testar a área do organizador, entre com a conta de demonstração **demo@gobeach.dev** / **gobeach123**. Ela é dona das aulas da carga inicial.

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
                     # sem SMTP_HOST, os e-mails de recuperação aparecem no log da API
npm test             # testes unitários
```

Frontend (porta 5173, com proxy de `/api` para `localhost:3000`):

```bash
cd frontend
npm install
npm run dev
npm test             # testes unitários (Vitest + Testing Library)
```

## Integração contínua

O workflow [.github/workflows/testes.yml](.github/workflows/testes.yml) roda a cada push e pull request: testes do backend, testes do frontend e o build do frontend. Os testes da API usam o banco mockado, então não precisam de PostgreSQL.

## API

As consultas são públicas e só mostram atividades publicadas. As rotas de escrita exigem login de organizador (PBI-11). A exceção é a moderação, que usa um token de administração.

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

### Autenticação e perfil do organizador (PBI-11)

Rotas marcadas com 🔒 exigem o cabeçalho `Authorization: Bearer <token>`, com o token devolvido no cadastro ou no login.

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/cadastro` | `{ nome, email, senha, telefone? }`. Cria a conta e devolve `{ token, organizador }` (`409` se o e-mail já tem conta) |
| POST | `/api/auth/login` | `{ email, senha }`. Devolve `{ token, organizador }`, ou `401` com a mesma mensagem para e-mail inexistente e senha errada |
| POST | `/api/auth/logout` 🔒 | Encerra a sessão atual |
| GET | `/api/auth/perfil` 🔒 | Dados do organizador logado |
| PUT | `/api/auth/perfil` 🔒 | `{ nome, telefone? }`. Atualiza o perfil |
| PUT | `/api/auth/senha` 🔒 | `{ senhaAtual, novaSenha }`. Troca a senha e encerra as outras sessões |
| POST | `/api/auth/recuperar-senha` | `{ email }`. Envia por e-mail um link de redefinição. A resposta é sempre a mesma, exista a conta ou não |
| POST | `/api/auth/redefinir-senha` | `{ token, novaSenha }`. Define a nova senha e encerra todas as sessões |

**Segurança:**
- **Senhas:** guardadas com scrypt e salt aleatório. Exigem pelo menos 8 caracteres, com letras e números.
- **Sessões:** valem 7 dias. Os tokens são aleatórios, e o banco guarda apenas o hash SHA-256 deles.
- **Link de recuperação:** vale 60 minutos e só pode ser usado uma vez.
- **Limite de tentativas por IP:** 10 por 15 minutos no login e no cadastro, e 5 por 15 minutos na recuperação de senha.

**E-mail:** no Docker, os e-mails vão para o Mailpit (http://localhost:8025). Para enviar e-mails de verdade, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `APP_URL` no `.env`.

### Cadastro de aulas (PBI-06)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/atividades/aulas` 🔒 | Cadastra uma aula vinculada ao organizador logado. Responde `201` com a aula (incluindo `publicada`) ou `400` com `{ erro, campos }` (uma mensagem por campo inválido) |
| PUT | `/api/atividades/aulas/:id` 🔒 | Edita a aula. Somente o organizador que a cadastrou pode editar; os demais recebem `403` |
| GET | `/api/atividades/minhas` 🔒 | Publicações do organizador logado, inclusive as que aguardam aprovação |
| GET | `/api/atividades/minhas/:id` 🔒 | Uma publicação do organizador logado (usada na tela de edição) |
| PATCH | `/api/atividades/:id/publicacao` | Corpo `{ "publicada": true | false }`. Aprova ou oculta uma atividade. Exige o cabeçalho `X-Admin-Token` |

Campos obrigatórios: `titulo`, `modalidade`, `praiaId`, `diasSemana` (lista com `Seg`, `Ter`, `Qua`, `Qui`, `Sex`, `Sáb`, `Dom`), `horaInicio` e `horaFim` (`HH:MM`, com o término depois do início), `instrutor` e `contato`. `localDetalhe` e `descricao` são opcionais.

**Publicação:** por padrão a aula é publicada assim que é cadastrada. Com `MODERAR_CADASTROS=true` no `.env`, ela fica oculta até alguém aprová-la pelo `PATCH` usando o `ADMIN_TOKEN` configurado.

## PBIs entregues (Sprint 1)

| PBI | Onde ver | Critérios de aceite atendidos |
|-----|----------|-------------------------------|
| **PBI-01** Consultar Praias | Aba **Praias** (Mapa ou Lista) | Mapa navegável (Leaflet + OpenStreetMap) com um marcador por praia, colorido pela balneabilidade, e popup com link para a página da praia; praias de Vitória, Vila Velha, Serra e Guarapari com nome e município; card clicável leva à página da praia (foto, descrição e link de localização no mapa); lista paginada, carregada em poucos milissegundos; busca e filtro por município, com a mensagem "Nenhuma praia encontrada" quando nada é encontrado |
| **PBI-02** Balneabilidade | Cards e página da praia | Tag verde (Própria) e vermelha (Imprópria); data/hora do boletim, data da coleta e órgão emissor; alerta amarelo "Pendente de atualização" quando o boletim tem mais de 7 dias; boletins sem data de coleta ou fonte são barrados pelo banco (`NOT NULL`) e nunca exibidos pela API |
| **PBI-03** Consultar Aulas | Aba **Aulas** | Modalidade, praia, dias, horário de início/término e instrutor; ordenação por modalidade ou praia; layout responsivo; botão "Ver Detalhes e Inscrição" em cada card |
| **PBI-04** Consultar Eventos | Aba **Eventos** | Título, modalidade, local exato, data, horário e gratuito/taxa; ordem cronológica (próximos no topo); API só de leitura; selo "Adiado"/"Cancelado" conforme o status |
| **PBI-05** Consultar Ações Comunitárias | Aba **Ações** | Título, objetivo ambiental, praia, ponto de encontro e data/horário; lista de recomendações; layout responsivo pensado para telas a partir de 360px; contador de voluntários atualizado a cada 10 segundos |

A carga inicial inclui casos para demonstração: praias com boletim vencido (Meaípe, Carapebus, Praia da Sereia), uma praia sem boletim (Ilha do Boi), um evento adiado e um cancelado.

## PBIs entregues (Sprint 2)

| PBI | Onde ver | Critérios de aceite atendidos |
|-----|----------|-------------------------------|
| **PBI-06** Cadastrar e Publicar Aulas Esportivas | Aba **Aulas**, botão **+ Cadastrar aula** (`/aulas/nova`, exige login) | Os campos obrigatórios são validados no navegador, que destaca cada campo e mostra a mensagem dele, e de novo na API, que devolve `400` com os erros por campo. O banco também barra aula sem campos obrigatórios ou com término antes do início (`CHECK`). A publicação é imediata ou passa por aprovação, conforme `MODERAR_CADASTROS`. Só o organizador que cadastrou a aula pode editá-la, pela **Minha área** ou pelo link "Editar esta aula". A listagem pública de aulas ganhou filtro por praia |
| **PBI-11** Autenticação e Perfil do Organizador | **Área do organizador** no topo (`/entrar`, `/criar-conta`, `/minha-area`) | Login por e-mail e senha, com validação no navegador e na API e mensagem única para credenciais erradas. Cadastro de conta. Recuperação de senha funcional: o link chega por e-mail (Mailpit no Docker), vale 60 minutos e só pode ser usado uma vez; ao redefinir, todas as sessões são encerradas. Na **Minha área**, o organizador gerencia as próprias aulas (publicadas ou aguardando aprovação), edita o perfil e troca a senha. As rotas da área do organizador mandam para o login quando não há sessão e voltam à página pedida depois |

> O esquema do banco mudou: há as tabelas `organizador`, `sessao` e `recuperacao_senha`, e a tabela `atividade` ganhou as colunas `publicada`, `organizador_id` e `atualizado_em`. Para quem já tinha o banco criado: `docker compose down -v && docker compose up -d --build`.

Ficam para as próximas sprints: cadastro de eventos e ações (PBI-07 e 08), filtros combinados (PBI-09), formulário de inscrição (PBI-10), alteração de status (PBI-12), busca textual global (PBI-13) e feedback (PBI-14).

## Documentação

- [Mini-Charter](docs/mini-charter.md)
- [Documento Executivo](docs/documento-executivo.md)
- [Product Backlog](docs/Product%20Backlog%20-%20GoBeach.pdf)
- [Roadmap Estratégico](docs/GoBeach_Strategic_Roadmap.pdf)

## Equipe

Davi Henrique Comério, Gian Lucca Decoté Paneto Neves, Gustavo Alves Caetano (gerente do projeto) e João Pedro Zamborlini Barcellos.
