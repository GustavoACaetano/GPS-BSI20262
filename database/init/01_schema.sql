-- GoBeach - esquema do banco de dados (Sprint 1: PBI-01 a PBI-05; Sprint 2: PBI-06 a PBI-13)

-- PBI-13: busca textual sem diferenciar acentos (unaccent) e sugestões por semelhança (pg_trgm)
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- PBI-01: praias da Grande Vitória
CREATE TABLE praia (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(120) NOT NULL,
    municipio   VARCHAR(20)  NOT NULL
                CHECK (municipio IN ('Vitória', 'Vila Velha', 'Serra', 'Guarapari')),
    descricao   TEXT,
    latitude    NUMERIC(9, 6) NOT NULL,
    longitude   NUMERIC(9, 6) NOT NULL,
    foto_url    TEXT,
    UNIQUE (nome, municipio)
);

-- PBI-02: boletins oficiais de balneabilidade (mitiga R1)
-- data_coleta e fonte são obrigatórias: nenhum status é exibido sem elas.
CREATE TYPE status_balneabilidade AS ENUM ('PROPRIA', 'IMPROPRIA');

CREATE TABLE boletim_balneabilidade (
    id            SERIAL PRIMARY KEY,
    praia_id      INTEGER NOT NULL REFERENCES praia (id) ON DELETE CASCADE,
    status        status_balneabilidade NOT NULL,
    data_coleta   DATE NOT NULL,
    data_boletim  TIMESTAMPTZ NOT NULL,
    fonte         VARCHAR(120) NOT NULL
);

CREATE INDEX idx_boletim_praia_data ON boletim_balneabilidade (praia_id, data_boletim DESC);

-- PBI-11: organizadores (instrutores, organizadores de eventos, ONGs)
CREATE TABLE organizador (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(120) NOT NULL,
    email       VARCHAR(254) NOT NULL CHECK (email = LOWER(email)),
    telefone    VARCHAR(40),
    senha_hash  TEXT NOT NULL,              -- scrypt$<salt>$<hash>
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (email)
);

-- Sessões de login: o cliente guarda o token; o banco só o hash SHA-256.
CREATE TABLE sessao (
    token_hash      CHAR(64) PRIMARY KEY,
    organizador_id  INTEGER NOT NULL REFERENCES organizador (id) ON DELETE CASCADE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira_em       TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessao_organizador ON sessao (organizador_id);

-- Recuperação de senha: link de uso único com validade curta.
CREATE TABLE recuperacao_senha (
    token_hash      CHAR(64) PRIMARY KEY,
    organizador_id  INTEGER NOT NULL REFERENCES organizador (id) ON DELETE CASCADE,
    expira_em       TIMESTAMPTZ NOT NULL,
    usado_em        TIMESTAMPTZ
);

-- PBI-03, PBI-04 e PBI-05: aulas, eventos esportivos e ações comunitárias
CREATE TYPE tipo_atividade AS ENUM ('AULA', 'EVENTO', 'ACAO_COMUNITARIA');
CREATE TYPE status_atividade AS ENUM ('ATIVO', 'ADIADO', 'CANCELADO');

CREATE TABLE atividade (
    id                  SERIAL PRIMARY KEY,
    tipo                tipo_atividade NOT NULL,
    titulo              VARCHAR(160) NOT NULL,
    descricao           TEXT,
    praia_id            INTEGER NOT NULL REFERENCES praia (id),
    responsavel         VARCHAR(120) NOT NULL,   -- instrutor, organizador ou ONG
    contato             VARCHAR(120),
    status              status_atividade NOT NULL DEFAULT 'ATIVO',
    -- PBI-12: aviso do organizador ao adiar/cancelar (exibido nas listagens) e quando o status mudou
    aviso_status        VARCHAR(300),
    status_alterado_em  TIMESTAMPTZ,
    modalidade          VARCHAR(60),             -- aulas e eventos
    local_detalhe       VARCHAR(160),            -- local exato na praia / ponto de encontro
    -- Aulas: recorrentes
    dias_semana         VARCHAR(60),
    hora_inicio         TIME,
    hora_fim            TIME,
    -- Eventos e ações: data única
    data_inicio         TIMESTAMPTZ,
    gratuito            BOOLEAN,
    valor_inscricao     NUMERIC(8, 2),
    -- PBI-07: regulamento do evento e limite de vagas (NULL = sem limite)
    regulamento         TEXT,
    limite_vagas        INTEGER CHECK (limite_vagas IS NULL OR limite_vagas > 0),
    -- PBI-10: total de inscrições, atualizado no mesmo comando que grava cada inscrição
    -- (o UPDATE com "inscritos < limite_vagas" impede estourar as vagas com inscrições simultâneas)
    inscritos           INTEGER NOT NULL DEFAULT 0,
    -- Ações comunitárias
    objetivo_ambiental  TEXT,
    recomendacoes       TEXT[] NOT NULL DEFAULT '{}',
    apoio_local         VARCHAR(300),            -- PBI-08: parceiros/apoiadores locais da ação
    -- PBI-06: publicação imediata ou sob aprovação (só publicadas aparecem nas consultas)
    publicada           BOOLEAN NOT NULL DEFAULT TRUE,
    -- PBI-11: organizador dono da publicação (só ele pode editá-la)
    organizador_id      INTEGER REFERENCES organizador (id) ON DELETE SET NULL,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em       TIMESTAMPTZ,

    CONSTRAINT aula_campos CHECK (
        tipo <> 'AULA' OR (modalidade IS NOT NULL AND dias_semana IS NOT NULL
                           AND hora_inicio IS NOT NULL AND hora_fim IS NOT NULL
                           AND hora_fim > hora_inicio)
    ),
    CONSTRAINT evento_campos CHECK (
        tipo <> 'EVENTO' OR (modalidade IS NOT NULL AND data_inicio IS NOT NULL
                             AND gratuito IS NOT NULL AND local_detalhe IS NOT NULL
                             AND regulamento IS NOT NULL AND contato IS NOT NULL
                             -- COALESCE: sem ele, FALSE OR NULL = NULL e o CHECK deixaria passar
                             AND (gratuito OR COALESCE(valor_inscricao, 0) > 0))
    ),
    -- PBI-12: adiar ou cancelar exige um aviso para quem acompanha a atividade
    CONSTRAINT aviso_ao_mudar_status CHECK (status = 'ATIVO' OR aviso_status IS NOT NULL),
    CONSTRAINT inscritos_dentro_do_limite CHECK (
        inscritos >= 0 AND (limite_vagas IS NULL OR inscritos <= limite_vagas)
    ),
    CONSTRAINT acao_campos CHECK (
        tipo <> 'ACAO_COMUNITARIA' OR (objetivo_ambiental IS NOT NULL AND data_inicio IS NOT NULL
                                       AND local_detalhe IS NOT NULL)
    )
);

CREATE INDEX idx_atividade_tipo ON atividade (tipo);
CREATE INDEX idx_atividade_praia ON atividade (praia_id);
CREATE INDEX idx_atividade_organizador ON atividade (organizador_id);
-- PBI-09: filtros combinados consultam só publicadas, por tipo e data
CREATE INDEX idx_atividade_explorar ON atividade (tipo, data_inicio) WHERE publicada;

-- PBI-10: inscrições e demonstrações de interesse (aulas, eventos e ações).
-- O contato (e-mail ou WhatsApp) só é visível para o organizador dono da atividade.
CREATE TABLE inscricao (
    id                   SERIAL PRIMARY KEY,
    atividade_id         INTEGER NOT NULL REFERENCES atividade (id) ON DELETE CASCADE,
    nome                 VARCHAR(120) NOT NULL,
    contato              VARCHAR(120) NOT NULL,
    -- e-mail em minúsculas ou só os dígitos do telefone: impede inscrição duplicada
    contato_normalizado  VARCHAR(120) NOT NULL,
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT inscricao_unica UNIQUE (atividade_id, contato_normalizado)
);

CREATE INDEX idx_inscricao_atividade ON inscricao (atividade_id);
