-- GoBeach - esquema do banco de dados (Sprint 1: PBI-01 a PBI-05)

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
    -- Ações comunitárias
    objetivo_ambiental  TEXT,
    recomendacoes       TEXT[] NOT NULL DEFAULT '{}',
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT aula_campos CHECK (
        tipo <> 'AULA' OR (modalidade IS NOT NULL AND dias_semana IS NOT NULL
                           AND hora_inicio IS NOT NULL AND hora_fim IS NOT NULL)
    ),
    CONSTRAINT evento_campos CHECK (
        tipo <> 'EVENTO' OR (modalidade IS NOT NULL AND data_inicio IS NOT NULL
                             AND gratuito IS NOT NULL AND local_detalhe IS NOT NULL)
    ),
    CONSTRAINT acao_campos CHECK (
        tipo <> 'ACAO_COMUNITARIA' OR (objetivo_ambiental IS NOT NULL AND data_inicio IS NOT NULL
                                       AND local_detalhe IS NOT NULL)
    )
);

CREATE INDEX idx_atividade_tipo ON atividade (tipo);
CREATE INDEX idx_atividade_praia ON atividade (praia_id);

-- Registros de interesse/inscrição. O formulário é escopo do PBI-10;
-- nesta sprint a tabela alimenta o contador de voluntários do PBI-05.
CREATE TABLE inscricao (
    id            SERIAL PRIMARY KEY,
    atividade_id  INTEGER NOT NULL REFERENCES atividade (id) ON DELETE CASCADE,
    nome          VARCHAR(120) NOT NULL,
    contato       VARCHAR(120) NOT NULL,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inscricao_atividade ON inscricao (atividade_id);
