# GoBeach

Plataforma que centraliza informações de praias, balneabilidade, aulas, eventos esportivos e ações comunitárias da Grande Vitória (ES).

Projeto da disciplina de Gerência de Projetos de Software (IFES — Campus Serra), grupo **Ardísia Software**.

Esta versão entrega a **Sprint 1** do [Product Backlog](docs/Product%20Backlog%20-%20GoBeach.pdf) (PBI-01 a PBI-05), o **PBI-06** (cadastro de aulas), o **PBI-07** (cadastro de eventos esportivos), o **PBI-08** (cadastro de ações comunitárias), o **PBI-09** (filtros combinados), o **PBI-10** (inscrições), o **PBI-11** (autenticação e perfil do organizador), o **PBI-12** (adiar ou cancelar atividades) e o **PBI-13** (busca por palavra-chave).

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

   Para testar a área do organizador, use as contas de demonstração (senha **gobeach123** em todas):
   - **demo@gobeach.dev**: dona das aulas da carga inicial.
   - **eventos@gobeach.dev**: dona dos eventos esportivos da carga inicial.
   - **ong@gobeach.dev**: dona das ações comunitárias da carga inicial.

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

As consultas são públicas e só mostram atividades publicadas. As rotas de escrita exigem login de organizador (PBI-11), com duas exceções: a inscrição em atividades (PBI-10), que é pública, e a moderação, que usa um token de administração.

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
| GET | `/api/atividades/explorar?busca=&categorias=&praia=&municipio=&modalidade=&de=&ate=&propria=` | **PBI-09/PBI-13.** Busca por palavra-chave e filtros combinados. Devolve `{ dados, total, contagem }`, com a contagem por categoria. Com `busca`, também devolve `praias` e, quando nada é encontrado, `sugestoes` |
| GET | `/api/atividades/modalidades` | **PBI-09.** Modalidades disponíveis, para as opções do filtro |

Todas as rotas de atividades aceitam `&praia=<id>` para filtrar por praia.

### Adiar ou cancelar (PBI-12)

Regras de `PATCH /api/atividades/:id/status`:
- **Aviso:** adiar ou cancelar exige um aviso aos participantes, de 5 a 300 caracteres. O aviso aparece nos cards das listagens e na página da atividade, e o banco também o exige com um `CHECK`.
- **Transições:** uma atividade ativa pode ser adiada ou cancelada. Uma adiada pode ser reativada (depois de ajustar a data na edição), ter o aviso atualizado ou ser cancelada.
- **Cancelamento definitivo:** a atividade cancelada não pode ser reativada nem editada, e novas inscrições são bloqueadas. Atividades que já aconteceram não mudam de status.
- **Aviso por e-mail:** ao adiar ou cancelar, os inscritos que deixaram e-mail recebem o aviso, enviado em segundo plano. A resposta informa quantos serão avisados (`avisados`). Falhas temporárias do servidor de e-mail (respostas SMTP 4xx, quedas de conexão) são tentadas de novo até 3 vezes. Inscritos que deixaram só WhatsApp ficam com o aviso visual.

### Inscrições (PBI-10)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/atividades/:id/inscricoes` | `{ nome, contato, consentimento: true }`. Registra a inscrição ou a demonstração de interesse e responde `201` com `{ inscricao, interessados, vagasRestantes }` |
| GET | `/api/atividades/minhas/:id/inscricoes` 🔒 | Inscritos de uma atividade do organizador logado, com nome, contato e data |
| GET | `/api/metricas` | Acompanhamento das metas do MVP: total de inscrições (meta de 100) e de atividades publicadas (meta de 30) |

**Contato:** pode ser um e-mail ou um WhatsApp com DDD. O consentimento para enviar o contato ao organizador é obrigatório, e o contato não aparece em nenhuma consulta pública.

**Quando a inscrição é recusada (`409`):** o campo `motivo` diz o porquê:
- `DUPLICADA`: o contato já está inscrito nessa atividade. O mesmo telefone escrito de outro jeito, ou o mesmo e-mail com outras maiúsculas, conta como o mesmo contato.
- `ESGOTADA`: as vagas acabaram.
- `CANCELADA`: a atividade foi cancelada.
- `ENCERRADA`: o evento ou a ação já aconteceu.

**Vagas:** a vaga é ocupada e a inscrição é gravada num único comando SQL, condicionado a `inscritos < limite_vagas`. Inscrições simultâneas não estouram o limite: num teste com 25 pedidos ao mesmo tempo e 2 vagas restantes, entraram exatamente 2. O banco reforça a regra com um `CHECK`, que também impede reduzir o limite de vagas para menos que o número de inscritos.

**Limite por IP:** no máximo 20 pedidos de inscrição a cada 15 minutos.

### Filtros combinados (PBI-09)

Todos os parâmetros de `/api/atividades/explorar` são opcionais e podem ser combinados:

| Parâmetro | Efeito |
|-----------|--------|
| `busca` | **PBI-13.** Palavras-chave, com até 100 caracteres e 5 palavras. Veja abaixo |
| `categorias` | `AULA`, `EVENTO` e/ou `ACAO_COMUNITARIA`, separados por vírgula. Vazio busca todas |
| `praia` / `municipio` | Restringe a uma praia ou a um município |
| `modalidade` | Busca exata, sem diferenciar maiúsculas. Ações comunitárias não têm modalidade, então saem do resultado |
| `de` e `ate` | Período em `AAAA-MM-DD`, no horário de Brasília, com até 1 ano. Eventos e ações entram pela data. Aulas, que são semanais, entram quando acontecem em algum dia da semana coberto pelo período |
| `propria=true` | Só atividades em praias cujo último boletim é "Própria" e não está pendente de atualização |

Como nas abas, só aparecem atividades publicadas, e eventos e ações passados ficam de fora.

### Busca por palavra-chave (PBI-13)

- **Busca parcial:** não diferencia maiúsculas nem acentos ("cambu" acha Camburi; "volei" acha "Vôlei"; "mutirao" acha "Mutirão"). Usa a extensão `unaccent` do PostgreSQL.
- **Várias palavras:** cada palavra precisa aparecer em algum dos campos pesquisados (título, descrição, modalidade, responsável, local, objetivo ecológico, praia e município). Assim, "futevolei itapua" traz só o futevôlei de Itapuã.
- **Praias:** a resposta inclui as praias cujo nome, município ou descrição combinam com a busca, com a balneabilidade de cada uma. A lista não aparece quando há filtro de praia ou de categoria.
- **Nenhum resultado:** a resposta traz `sugestoes`:
  - `termos`: até 3 termos existentes parecidos com o digitado (praias, municípios, modalidades e palavras dos títulos), para corrigir erros de digitação. Por exemplo, "surff" sugere "Surf" e "camburri" sugere "Camburi". Usa a extensão `pg_trgm`.
  - `semFiltros`: quando há outros filtros ativos, quantos resultados existiriam só com a busca.
- **Curingas:** `%` e `_` digitados são buscados como texto comum.

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

### Cadastro de aulas (PBI-06), eventos esportivos (PBI-07) e ações comunitárias (PBI-08)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/atividades/aulas` 🔒 | Cadastra uma aula vinculada ao organizador logado. Responde `201` com a aula (incluindo `publicada`) ou `400` com `{ erro, campos }` (uma mensagem por campo inválido) |
| PUT | `/api/atividades/aulas/:id` 🔒 | Edita a aula. Somente o organizador que a cadastrou pode editar; os demais recebem `403` |
| GET | `/api/atividades/minhas` 🔒 | Publicações do organizador logado, inclusive as que aguardam aprovação |
| GET | `/api/atividades/minhas/:id` 🔒 | Uma publicação do organizador logado (usada na tela de edição) |
| POST | `/api/atividades/eventos` 🔒 | **PBI-07.** Cadastra um evento esportivo vinculado ao organizador logado. Mesmas respostas do cadastro de aulas |
| PUT | `/api/atividades/eventos/:id` 🔒 | **PBI-07.** Edita o evento. Somente o organizador que o cadastrou pode editar |
| POST | `/api/atividades/acoes` 🔒 | **PBI-08.** Cadastra uma ação comunitária vinculada ao organizador logado. Mesmas respostas do cadastro de aulas |
| PUT | `/api/atividades/acoes/:id` 🔒 | **PBI-08.** Edita a ação. Somente o organizador que a cadastrou pode editar |
| PATCH | `/api/atividades/:id/status` 🔒 | **PBI-12.** Corpo `{ "status": "ATIVO" \| "ADIADO" \| "CANCELADO", "aviso": "..." }`. Adia, cancela ou reativa a atividade; só o organizador dono pode usar |
| PATCH | `/api/atividades/:id/publicacao` | Corpo `{ "publicada": true | false }`. Aprova ou oculta uma atividade. Exige o cabeçalho `X-Admin-Token` |

Campos obrigatórios: `titulo`, `modalidade`, `praiaId`, `diasSemana` (lista com `Seg`, `Ter`, `Qua`, `Qui`, `Sex`, `Sáb`, `Dom`), `horaInicio` e `horaFim` (`HH:MM`, com o término depois do início), `instrutor` e `contato`. `localDetalhe` e `descricao` são opcionais.

Campos do evento esportivo:
- **Obrigatórios:** `titulo`, `modalidade`, `regulamento` (até 5000 caracteres), `praiaId`, `localDetalhe`, `data` (`AAAA-MM-DD`), `hora` (`HH:MM`), `responsavel` (o organizador do evento), `contato` e `gratuito` (`true` ou `false`).
- **Valor da inscrição:** `valorInscricao` é obrigatório quando `gratuito` é `false`. Precisa ser maior que zero e de no máximo R$ 9.999,99.
- **Vagas:** `limiteVagas` é um inteiro maior que zero. Vazio ou `null` significa sem limite de vagas.
- **Opcional:** `descricao`.
- **Data:** a data e a hora são lidas no horário de Brasília. O evento precisa ser futuro e ter no máximo 2 anos de antecedência.
- **Banco:** regulamento, contato e valor (quando o evento é pago) também são exigidos por um `CHECK` na tabela.

Campos da ação comunitária:
- **Obrigatórios:** `titulo`, `objetivoAmbiental` (o objetivo ecológico), `praiaId`, `pontoEncontro`, `data` (`AAAA-MM-DD`), `hora` (`HH:MM`), `responsavel` (a organização responsável) e `contato`.
- **Opcionais:** `apoioLocal` (parceiros como prefeitura, comércio ou associação de moradores), `descricao` e `recomendacoes` (lista com até 10 itens de até 120 caracteres).
- **Data:** a data e a hora são lidas no horário de Brasília. A ação precisa ser futura e ter no máximo 2 anos de antecedência.

**Publicação:** por padrão a aula, o evento ou a ação é publicado assim que é cadastrada. Com `MODERAR_CADASTROS=true` no `.env`, ela fica oculta até alguém aprová-la pelo `PATCH` usando o `ADMIN_TOKEN` configurado.

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
| **PBI-07** Cadastrar e Publicar Eventos Esportivos | Aba **Eventos**, botão **+ Cadastrar evento** (`/eventos/novo`, exige login) | Regulamento e dados de contato são obrigatórios; o regulamento aparece na página do evento, com as quebras de linha preservadas. O organizador define o limite de vagas, que aparece no card ("64 vagas"), ou deixa o campo em branco para "Sem limite de vagas". Também se informa se o evento é gratuito ou pago; o campo de valor só aparece quando é pago. Os campos são validados no navegador, na API e no banco (`CHECK`). Vale a mesma moderação opcional das aulas. Só o organizador dono edita o evento, e a **Minha área** mostra a seção "Meus eventos esportivos" |
| **PBI-08** Cadastrar Ações Comunitárias | Aba **Ações**, botão **+ Cadastrar ação** (`/acoes/nova`, exige login) | Objetivo ecológico obrigatório e apoio local opcional, os dois exibidos no card da ação. O organizador responsável fica registrado de duas formas: a organização informada aparece no card, e a ação fica vinculada à conta que a cadastrou, que é a única que pode editá-la. Os campos são validados no navegador e na API, com data futura no horário de Brasília. Vale a mesma moderação opcional das aulas. Na **Minha área**, as ações aparecem separadas das aulas, e as já realizadas ficam marcadas como "Realizada", sem opção de edição |
| **PBI-09** Filtrar Conteúdo por Categoria e Praia | Aba **Explorar** (`/explorar`) e botão "Explorar atividades nesta praia" na página de cada praia | Filtros combinados de categoria (uma ou várias), município, praia, modalidade, período ("Hoje", "Neste fim de semana", "Próximos 7/30 dias" ou datas escolhidas) e "só praias próprias para banho". A lista se atualiza a cada mudança, sem botão de buscar, e mostra o número de resultados; os resultados anteriores continuam visíveis enquanto a nova busca carrega. Os resultados vêm agrupados por categoria, com a contagem de cada uma. Ao escolher uma praia, aparece a balneabilidade dela. Os filtros ficam na URL, então o link pode ser compartilhado e o "voltar" do navegador funciona. Há um botão "Limpar filtros", e uma mensagem com esse mesmo botão quando nada é encontrado. Com o banco local, a busca responde em cerca de 50 ms |
| **PBI-10** Demonstrar Interesse ou Inscrever-se | Página de cada aula, evento ou ação, e **Minha área → Inscritos** | Coleta nome e e-mail ou WhatsApp, com validação no navegador e na API e consentimento obrigatório para enviar o contato ao organizador. A confirmação aparece na tela, com o número de inscritos e as vagas restantes, e o contador do card é recarregado na hora. Os cards de aulas, eventos e ações mostram o contador de interessados, inscritos ou voluntários. Os eventos mostram as vagas disponíveis e "Vagas esgotadas" quando lotam, e aí o formulário some; o mesmo acontece em atividades canceladas ou já realizadas. Inscrição duplicada é recusada. O organizador dono vê a lista de inscritos, com links para e-mail ou WhatsApp e um botão para copiar os contatos. A rota `/api/metricas` acompanha a meta de 100 inscrições do MVP |
| **PBI-12** Atualizar Status ou Cancelar Atividade | **Minha área → Status**, ou "Adiar ou cancelar" na página da atividade (`/minha-area/status/:id`) | O organizador dono altera o status para "Adiado" ou "Cancelado", com um aviso obrigatório aos participantes, ou reativa uma atividade adiada. Para cancelar, é preciso confirmar que a ação é definitiva. A notificação visual aparece nas listagens (abas, Explorar e página da praia) e na página da atividade: o selo "Adiado" ou "Cancelado" e uma faixa colorida com o aviso. Atividades canceladas não aceitam inscrições nem edição. Os inscritos com e-mail recebem o aviso, com novas tentativas em caso de falha temporária. Os eventos adiado e cancelado da carga inicial já trazem avisos |
| **PBI-13** Pesquisa Textual por Palavra-Chave | Campo **Buscar** no topo de todas as páginas e na aba **Explorar** | A busca é parcial e não diferencia maiúsculas nem acentos. Combina com os filtros do PBI-09 e atualiza os resultados depois de uma pausa na digitação. Além das atividades, mostra as praias encontradas. Quando nada é encontrado, exibe "Nenhum resultado para '…'" com sugestões clicáveis ("Você quis dizer: Surf") e, se houver outros filtros ativos, o botão "Buscar '…' sem os outros filtros (N resultados)". Sem sugestões, dá dicas de como buscar |
| **PBI-11** Autenticação e Perfil do Organizador | **Área do organizador** no topo (`/entrar`, `/criar-conta`, `/minha-area`) | Login por e-mail e senha, com validação no navegador e na API e mensagem única para credenciais erradas. Cadastro de conta. Recuperação de senha funcional: o link chega por e-mail (Mailpit no Docker), vale 60 minutos e só pode ser usado uma vez; ao redefinir, todas as sessões são encerradas. Na **Minha área**, o organizador gerencia as próprias aulas (publicadas ou aguardando aprovação), edita o perfil e troca a senha. As rotas da área do organizador mandam para o login quando não há sessão e voltam à página pedida depois |

> O esquema do banco mudou (incluindo um índice novo para os filtros do PBI-09 e as extensões `unaccent` e `pg_trgm` do PBI-13): há as tabelas `organizador`, `sessao` e `recuperacao_senha`, e a tabela `atividade` ganhou as colunas `publicada`, `organizador_id`, `atualizado_em`, `apoio_local`, `regulamento`, `limite_vagas`, `inscritos`, `aviso_status` e `status_alterado_em`. A tabela `inscricao` ganhou a coluna `contato_normalizado` e uma restrição de unicidade. Para quem já tinha o banco criado: `docker compose down -v && docker compose up -d --build`.

Fica para a próxima sprint: feedback (PBI-14).

## Documentação

- [Mini-Charter](docs/mini-charter.md)
- [Documento Executivo](docs/documento-executivo.md)
- [Product Backlog](docs/Product%20Backlog%20-%20GoBeach.pdf)
- [Roadmap Estratégico](docs/GoBeach_Strategic_Roadmap.pdf)

## Equipe

Davi Henrique Comério, Gian Lucca Decoté Paneto Neves, Gustavo Alves Caetano (gerente do projeto) e João Pedro Zamborlini Barcellos.
