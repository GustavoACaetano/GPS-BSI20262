import pg from 'pg';

const { Pool, types } = pg;

// Retorna NUMERIC como número e DATE como string 'YYYY-MM-DD' (sem conversão de fuso).
types.setTypeParser(types.builtins.NUMERIC, (valor) => Number(valor));
types.setTypeParser(types.builtins.DATE, (valor) => valor);

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://gobeach:gobeach@localhost:5432/gobeach',
});

// Sem este ouvinte, a queda de uma conexão ociosa (ex.: o banco reiniciou) derruba o processo da API.
// O pool descarta a conexão quebrada e abre outra na próxima consulta.
pool.on('error', (erro) => {
  console.error('Conexão com o banco perdida:', erro.message);
});

export const query = (texto, parametros) => pool.query(texto, parametros);
