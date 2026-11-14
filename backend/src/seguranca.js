// PBI-11: hash de senhas (scrypt) e tokens aleatórios, só com node:crypto.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const TAMANHO_CHAVE = 64;

// Formato armazenado: "scrypt$<salt hex>$<hash hex>".
export async function gerarHashSenha(senha) {
  const salt = randomBytes(16).toString('hex');
  const chave = await scryptAsync(senha, salt, TAMANHO_CHAVE);
  return `scrypt$${salt}$${chave.toString('hex')}`;
}

// Hash usado quando o e-mail não existe, para o login levar o mesmo tempo nos dois casos.
const HASH_FICTICIO = `scrypt$${'0'.repeat(32)}$${'0'.repeat(TAMANHO_CHAVE * 2)}`;

export async function conferirSenha(senha, armazenado) {
  const [algoritmo, salt, hash] = (armazenado || HASH_FICTICIO).split('$');
  if (algoritmo !== 'scrypt' || !salt || !hash) return false;
  const esperado = Buffer.from(hash, 'hex');
  const calculado = await scryptAsync(String(senha), salt, esperado.length);
  return Boolean(armazenado) && timingSafeEqual(calculado, esperado);
}

export const gerarToken = () => randomBytes(32).toString('hex');

export const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex');

export function mesmoSegredo(recebido, esperado) {
  if (typeof recebido !== 'string' || !recebido || !esperado) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
