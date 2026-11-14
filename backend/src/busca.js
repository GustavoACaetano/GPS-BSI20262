// PBI-13: pesquisa textual por palavra-chave.
// Busca parcial, sem diferenciar maiúsculas nem acentos ("cambu" acha "Camburi"; "volei" acha "Vôlei").
// Com várias palavras, cada uma precisa aparecer em algum dos campos pesquisados.
import { query } from './db.js';
import { formatarBoletim } from './balneabilidade.js';

const MAX_TAMANHO = 100;
const MAX_PALAVRAS = 5;
// Semelhança mínima (0 a 1) para sugerir um termo; com 0,3 apareciam sugestões sem relação ("surff" -> "Subaquática").
export const NOTA_MINIMA = 0.4;

// Campos da atividade (e da praia) considerados na busca.
export const CAMPOS_BUSCA = `concat_ws(' ', a.titulo, a.descricao, a.modalidade, a.responsavel,
  a.local_detalhe, a.objetivo_ambiental, p.nome, p.municipio)`;

// Escapa os curingas do LIKE para o texto digitado ser buscado literalmente.
export const escaparLike = (texto) => texto.replace(/[\\%_]/g, (c) => `\\${c}`);

// Texto digitado -> lista de palavras (sem repetição), ou { erro }.
export function lerBusca(valor) {
  const texto = String(valor ?? '').trim().replace(/\s+/g, ' ');
  if (!texto) return { palavras: [] };
  if (texto.length > MAX_TAMANHO) return { erro: `A busca pode ter no máximo ${MAX_TAMANHO} caracteres.` };
  const palavras = [...new Set(texto.toLowerCase().split(' '))];
  if (palavras.length > MAX_PALAVRAS) return { erro: `Use no máximo ${MAX_PALAVRAS} palavras na busca.` };
  return { texto, palavras };
}

// Uma condição LIKE por palavra; `p` registra o parâmetro e devolve o marcador ($n).
export function condicoesBusca(palavras, p, campos = CAMPOS_BUSCA) {
  return palavras.map(
    (palavra) => `unaccent(lower(${campos})) LIKE '%' || unaccent(lower(${p(escaparLike(palavra))})) || '%' ESCAPE '\\'`,
  );
}

// Praias cujo nome, município ou descrição contêm todas as palavras.
export async function buscarPraias(palavras, municipio) {
  if (palavras.length === 0) return [];
  const parametros = [];
  const p = (valor) => {
    parametros.push(valor);
    return `$${parametros.length}`;
  };
  const filtros = condicoesBusca(palavras, p, "concat_ws(' ', pr.nome, pr.municipio, pr.descricao)");
  if (municipio) filtros.push(`pr.municipio = ${p(municipio)}`);

  const resultado = await query(
    `SELECT pr.id, pr.nome, pr.municipio, b.id AS b_id, b.status AS b_status, b.data_coleta AS b_data_coleta,
            b.data_boletim AS b_data_boletim, b.fonte AS b_fonte
     FROM praia pr
     LEFT JOIN LATERAL (
       SELECT * FROM boletim_balneabilidade
       WHERE praia_id = pr.id AND data_coleta IS NOT NULL AND fonte IS NOT NULL
       ORDER BY data_boletim DESC LIMIT 1
     ) b ON TRUE
     WHERE ${filtros.join(' AND ')}
     ORDER BY pr.nome
     LIMIT 10`,
    parametros,
  );
  return resultado.rows.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    municipio: linha.municipio,
    balneabilidade: formatarBoletim(
      linha.b_id && {
        id: linha.b_id,
        status: linha.b_status,
        data_coleta: linha.b_data_coleta,
        data_boletim: linha.b_data_boletim,
        fonte: linha.b_fonte,
      },
    ),
  }));
}

// "Você quis dizer": termos existentes parecidos com o que foi digitado (erros de digitação).
// O vocabulário reúne praias, municípios, modalidades e palavras dos títulos publicados.
export async function sugerirTermos(texto) {
  const resultado = await query(
    `WITH vocabulario AS (
       SELECT nome AS termo FROM praia
       UNION SELECT municipio FROM praia
       UNION SELECT modalidade FROM atividade WHERE publicada AND modalidade IS NOT NULL
       UNION SELECT palavra FROM atividade, regexp_split_to_table(titulo, '[^[:alnum:]]+') AS palavra
             WHERE publicada AND length(palavra) >= 4
     ), pontuado AS (
       SELECT termo, GREATEST(similarity(unaccent(lower(termo)), unaccent(lower($1))),
                              word_similarity(unaccent(lower($1)), unaccent(lower(termo)))) AS nota
       FROM vocabulario
     )
     SELECT MIN(termo) AS termo, MAX(nota) AS nota FROM pontuado
     WHERE nota >= ${NOTA_MINIMA} AND unaccent(lower(termo)) <> unaccent(lower($1))
     GROUP BY unaccent(lower(termo))
     ORDER BY nota DESC, termo
     LIMIT 3`,
    [texto],
  );
  return resultado.rows.map((r) => r.termo);
}
