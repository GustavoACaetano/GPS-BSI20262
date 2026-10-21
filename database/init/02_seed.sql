-- GoBeach - carga inicial de dados (mitiga R8: falta de dados iniciais)
-- Datas relativas a NOW() para que o ambiente de demonstração esteja sempre coerente.

INSERT INTO praia (nome, municipio, descricao, latitude, longitude) VALUES
    ('Camburi',               'Vitória',    'Maior praia de Vitória, com 6 km de orla, ciclovia e quiosques.',             -20.2700, -40.2870),
    ('Praia do Canto',        'Vitória',    'Praia urbana de águas calmas, próxima à Praça dos Namorados.',                 -20.2960, -40.2930),
    ('Curva da Jurema',       'Vitória',    'Ponto tradicional de stand up paddle e vôlei de praia.',                       -20.3080, -40.2890),
    ('Ilha do Boi',           'Vitória',    'Pequenas enseadas de águas claras, boas para mergulho.',                       -20.3110, -40.2810),
    ('Praia da Costa',        'Vila Velha', 'Orla movimentada com vista para o Convento da Penha.',                         -20.3340, -40.2830),
    ('Itapuã',                'Vila Velha', 'Praia extensa e popular para futevôlei e caminhadas.',                         -20.3530, -40.2930),
    ('Itaparica',             'Vila Velha', 'Ondas constantes, muito frequentada por surfistas.',                           -20.3730, -40.3000),
    ('Praia da Sereia',       'Vila Velha', 'Praia de águas tranquilas entre pedras.',                                      -20.3290, -40.2780),
    ('Jacaraípe',             'Serra',      'Ondas fortes, palco de campeonatos de surf no estado.',                       -20.1500, -40.1880),
    ('Manguinhos',            'Serra',      'Vila de pescadores com gastronomia e praia de águas calmas.',                 -20.1930, -40.1960),
    ('Nova Almeida',          'Serra',      'Praia histórica ao lado da Igreja dos Reis Magos.',                            -20.0560, -40.1950),
    ('Carapebus',             'Serra',      'Praia de areia clara cercada por restinga.',                                   -20.2350, -40.2140),
    ('Praia do Morro',        'Guarapari',  'Principal praia de Guarapari, com areias monazíticas.',                        -20.6550, -40.4870),
    ('Praia das Castanheiras','Guarapari',  'Praia central, sombreada por castanheiras.',                                   -20.6720, -40.4980),
    ('Setiba',                'Guarapari',  'Dentro da área do Parque Estadual Paulo César Vinha.',                         -20.6320, -40.4250),
    ('Meaípe',                'Guarapari',  'Praia de pescadores famosa pela moqueca.',                                     -20.7350, -40.5310);

-- Boletins: a maioria recente; alguns com mais de 7 dias para demonstrar o alerta
-- "Pendente de atualização"; Ilha do Boi sem boletim para demonstrar a ausência de dados.
INSERT INTO boletim_balneabilidade (praia_id, status, data_coleta, data_boletim, fonte)
SELECT p.id, b.status::status_balneabilidade,
       (NOW() - (b.dias_atras + 1) * INTERVAL '1 day')::date,
       NOW() - b.dias_atras * INTERVAL '1 day',
       b.fonte
FROM (VALUES
    ('Camburi',                'PROPRIA',   2,  'Prefeitura de Vitória'),
    ('Camburi',                'IMPROPRIA', 9,  'Prefeitura de Vitória'),
    ('Praia do Canto',         'IMPROPRIA', 2,  'Prefeitura de Vitória'),
    ('Curva da Jurema',        'PROPRIA',   2,  'Prefeitura de Vitória'),
    ('Praia da Costa',         'PROPRIA',   3,  'IEMA'),
    ('Itapuã',                 'PROPRIA',   3,  'IEMA'),
    ('Itaparica',              'IMPROPRIA', 3,  'IEMA'),
    ('Praia da Sereia',        'PROPRIA',   12, 'IEMA'),
    ('Jacaraípe',              'PROPRIA',   1,  'Prefeitura da Serra'),
    ('Manguinhos',             'PROPRIA',   1,  'Prefeitura da Serra'),
    ('Nova Almeida',           'IMPROPRIA', 1,  'Prefeitura da Serra'),
    ('Carapebus',              'PROPRIA',   10, 'Prefeitura da Serra'),
    ('Praia do Morro',         'PROPRIA',   4,  'IEMA'),
    ('Praia das Castanheiras', 'IMPROPRIA', 4,  'IEMA'),
    ('Setiba',                 'PROPRIA',   4,  'IEMA'),
    ('Meaípe',                 'PROPRIA',   15, 'IEMA')
) AS b (praia, status, dias_atras, fonte)
JOIN praia p ON p.nome = b.praia;

-- PBI-03: aulas
INSERT INTO atividade (tipo, titulo, descricao, praia_id, responsavel, contato, modalidade,
                       local_detalhe, dias_semana, hora_inicio, hora_fim)
SELECT 'AULA', a.titulo, a.descricao, p.id, a.responsavel, a.contato, a.modalidade,
       a.local_detalhe, a.dias, a.inicio::time, a.fim::time
FROM (VALUES
    ('Escolinha de Surf Itaparica', 'Aulas para iniciantes com prancha inclusa.', 'Itaparica',
     'Rafael Lima', '(27) 99999-0001', 'Surf', 'Em frente ao quiosque 12', 'Ter, Qui, Sáb', '07:00', '08:30'),
    ('Futevôlei na Itapuã', 'Treinos de fundamentos e jogo.', 'Itapuã',
     'Carla Menezes', '(27) 99999-0002', 'Futevôlei', 'Rede próxima ao posto 3', 'Seg, Qua, Sex', '17:30', '19:00'),
    ('Stand Up Paddle na Curva', 'Aulas em águas calmas para todas as idades.', 'Curva da Jurema',
     'Bruno Tavares', '(27) 99999-0003', 'Stand Up Paddle', 'Base de SUP ao lado do píer', 'Sáb, Dom', '08:00', '09:30'),
    ('Vôlei de Praia Camburi', 'Turmas de iniciação e intermediário.', 'Camburi',
     'Juliana Rocha', '(27) 99999-0004', 'Vôlei de praia', 'Quadras em frente à Praça do Cauê', 'Ter, Qui', '06:30', '08:00'),
    ('Surf Jacaraípe Kids', 'Surf para crianças de 7 a 14 anos.', 'Jacaraípe',
     'Diego Alves', '(27) 99999-0005', 'Surf', 'Próximo à Pedra da Baleia', 'Sáb', '09:00', '10:30'),
    ('Beach Tennis Praia do Morro', 'Aulas em grupo com raquetes disponíveis.', 'Praia do Morro',
     'Fernanda Souza', '(27) 99999-0006', 'Beach tennis', 'Quadras do calçadão', 'Seg, Qua', '18:00', '19:30'),
    ('Funcional na Areia', 'Treino funcional ao ar livre.', 'Praia da Costa',
     'Marcos Pereira', '(27) 99999-0007', 'Treino funcional', 'Em frente à Rua Inácio Higino', 'Seg, Qua, Sex', '06:00', '07:00')
) AS a (titulo, descricao, praia, responsavel, contato, modalidade, local_detalhe, dias, inicio, fim)
JOIN praia p ON p.nome = a.praia;

-- PBI-04: eventos esportivos (inclui um adiado e um cancelado)
INSERT INTO atividade (tipo, titulo, descricao, praia_id, responsavel, contato, modalidade,
                       local_detalhe, data_inicio, gratuito, valor_inscricao, status)
SELECT 'EVENTO', e.titulo, e.descricao, p.id, e.responsavel, e.contato, e.modalidade,
       e.local_detalhe, date_trunc('day', NOW()) + e.dias * INTERVAL '1 day' + INTERVAL '9 hours',
       e.gratuito, e.valor, e.status::status_atividade
FROM (VALUES
    ('Circuito Capixaba de Surf - Etapa Serra', 'Etapa estadual nas categorias open e júnior.', 'Jacaraípe',
     'Federação de Surf do ES', 'contato@fesurf.org', 'Surf', 'Pico da Pedra da Baleia', 12, FALSE, 80.00, 'ATIVO'),
    ('Torneio de Futevôlei de Verão', 'Duplas mistas, chaves por nível.', 'Itapuã',
     'Liga Vilavelhense de Futevôlei', '(27) 98888-0001', 'Futevôlei', 'Arena montada no posto 4', 5, FALSE, 40.00, 'ATIVO'),
    ('Vôlei de Praia Open Camburi', 'Torneio aberto ao público.', 'Camburi',
     'Associação Camburi Esportes', '(27) 98888-0002', 'Vôlei de praia', 'Quadras da Praça do Cauê', 3, TRUE, NULL, 'ATIVO'),
    ('Travessia a Nado Praia da Costa', 'Prova de 1,5 km em mar aberto.', 'Praia da Costa',
     'Clube Aquático VV', 'nado@clubevv.org', 'Natação em águas abertas', 'Largada em frente ao Clube Libanês', 20, FALSE, 60.00, 'ADIADO'),
    ('Corrida na Areia Guarapari', 'Percurso de 5 km pela orla.', 'Praia do Morro',
     'Guarapari Run', '(27) 98888-0003', 'Corrida', 'Largada na Praça do Morro', 8, TRUE, NULL, 'CANCELADO'),
    ('Festival de Stand Up Paddle', 'Provas de velocidade e passeio.', 'Curva da Jurema',
     'SUP Vitória', '(27) 98888-0004', 'Stand Up Paddle', 'Píer da Curva da Jurema', 15, TRUE, NULL, 'ATIVO')
) AS e (titulo, descricao, praia, responsavel, contato, modalidade, local_detalhe, dias, gratuito, valor, status)
JOIN praia p ON p.nome = e.praia;

-- PBI-05: ações comunitárias
INSERT INTO atividade (tipo, titulo, descricao, praia_id, responsavel, contato, local_detalhe,
                       data_inicio, objetivo_ambiental, recomendacoes)
SELECT 'ACAO_COMUNITARIA', c.titulo, c.descricao, p.id, c.responsavel, c.contato, c.local_detalhe,
       date_trunc('day', NOW()) + c.dias * INTERVAL '1 day' + INTERVAL '8 hours',
       c.objetivo, c.recomendacoes
FROM (VALUES
    ('Mutirão de Limpeza de Camburi', 'Coleta de resíduos ao longo da orla.', 'Camburi',
     'Instituto Orla Limpa', 'voluntarios@orlalimpa.org', 'Píer de Iemanjá', 4,
     'Retirar resíduos sólidos da faixa de areia e conscientizar banhistas.',
     ARRAY['Levar luvas', 'Usar protetor solar', 'Levar garrafa de água']),
    ('Restinga Viva Setiba', 'Plantio de mudas nativas da restinga.', 'Setiba',
     'Amigos do Paulo César Vinha', '(27) 97777-0001', 'Entrada do parque, estacionamento', 9,
     'Recuperar a vegetação de restinga degradada.',
     ARRAY['Usar calçado fechado', 'Levar boné', 'Levar repelente']),
    ('Limpeza Subaquática Ilha do Boi', 'Mergulhadores retiram lixo do fundo das enseadas.', 'Ilha do Boi',
     'Projeto Mar Limpo', 'marlimpo@exemplo.org', 'Enseada principal', 11,
     'Remover resíduos submersos que afetam a vida marinha.',
     ARRAY['Trazer equipamento de mergulho', 'Credencial de mergulho obrigatória']),
    ('Praia Sem Bituca Jacaraípe', 'Coleta de bitucas de cigarro e microlixo.', 'Jacaraípe',
     'Coletivo Serra Verde', '(27) 97777-0002', 'Quiosque do Surf Clube', 6,
     'Reduzir a presença de bitucas e microplásticos na areia.',
     ARRAY['Levar luvas', 'Levar sacola reutilizável', 'Usar protetor solar'])
) AS c (titulo, descricao, praia, responsavel, contato, local_detalhe, dias, objetivo, recomendacoes)
JOIN praia p ON p.nome = c.praia;

-- Interessados já registrados nas ações comunitárias (contador do PBI-05)
INSERT INTO inscricao (atividade_id, nome, contato)
SELECT a.id, 'Voluntário ' || n, 'voluntario' || n || '@exemplo.com'
FROM atividade a
CROSS JOIN LATERAL generate_series(1, 5 + (a.id % 4) * 6) AS n
WHERE a.tipo = 'ACAO_COMUNITARIA';
