import pg from 'pg';

const { Pool, types } = pg;

// Retorna NUMERIC como número e DATE como string 'YYYY-MM-DD' (sem conversão de fuso).
types.setTypeParser(types.builtins.NUMERIC, (valor) => Number(valor));
types.setTypeParser(types.builtins.DATE, (valor) => valor);

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://gobeach:gobeach@localhost:5432/gobeach',
});

export const query = (texto, parametros) => pool.query(texto, parametros);
