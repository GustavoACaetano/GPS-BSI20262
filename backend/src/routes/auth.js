// PBI-11: Autenticação e Perfil do Organizador
import { Router } from 'express';
import { query } from '../db.js';
import { correio } from '../email.js';
import { criarSessao, exigirLogin, formatarOrganizador } from '../autenticacao.js';
import { limitarTentativas } from '../limitador.js';
import { conferirSenha, gerarHashSenha, gerarToken, hashToken } from '../seguranca.js';
import { validarCadastro, validarEmail, validarPerfil, validarSenha } from '../validacaoConta.js';

const router = Router();

const QUINZE_MINUTOS = 15 * 60 * 1000;
const VALIDADE_RECUPERACAO_MIN = 60;
const EMAIL_DUPLICADO = '23505'; // unique_violation

const invalido = (res, campos) => res.status(400).json({ erro: 'Revise os campos destacados.', campos });

// POST /api/auth/cadastro  { nome, email, senha, telefone? }
router.post('/cadastro', limitarTentativas({ nome: 'cadastro', maximo: 10, janelaMs: QUINZE_MINUTOS }), async (req, res, next) => {
  try {
    const { dados, campos } = validarCadastro(req.body);
    if (campos) return invalido(res, campos);

    const resultado = await query(
      `INSERT INTO organizador (nome, email, telefone, senha_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, nome, email, telefone`,
      [dados.nome, dados.email, dados.telefone, await gerarHashSenha(dados.senha)],
    );
    const organizador = formatarOrganizador(resultado.rows[0]);
    res.status(201).json({ token: await criarSessao(organizador.id), organizador });
  } catch (erro) {
    if (erro.code === EMAIL_DUPLICADO) {
      return res.status(409).json({
        erro: 'Revise os campos destacados.',
        campos: { email: 'Já existe uma conta com este e-mail.' },
      });
    }
    next(erro);
  }
});

// POST /api/auth/login  { email, senha }
router.post('/login', limitarTentativas({ nome: 'login', maximo: 10, janelaMs: QUINZE_MINUTOS }), async (req, res, next) => {
  try {
    const campos = {};
    const email = validarEmail(req.body?.email, campos);
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
    if (!senha) campos.senha = 'Senha é obrigatória.';
    if (Object.keys(campos).length > 0) return invalido(res, campos);

    const resultado = await query(
      'SELECT id, nome, email, telefone, senha_hash FROM organizador WHERE email = $1',
      [email],
    );
    const linha = resultado.rows[0];
    // Confere a senha mesmo sem conta, para não revelar quais e-mails existem pelo tempo de resposta.
    const confere = await conferirSenha(senha, linha?.senha_hash);
    if (!linha || !confere) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }
    res.json({ token: await criarSessao(linha.id), organizador: formatarOrganizador(linha) });
  } catch (erro) {
    next(erro);
  }
});

// POST /api/auth/logout
router.post('/logout', exigirLogin, async (req, res, next) => {
  try {
    await query('DELETE FROM sessao WHERE token_hash = $1', [hashToken(req.tokenSessao)]);
    res.status(204).end();
  } catch (erro) {
    next(erro);
  }
});

// GET /api/auth/perfil
router.get('/perfil', exigirLogin, (req, res) => {
  res.json(req.organizador);
});

// PUT /api/auth/perfil  { nome, telefone? }
router.put('/perfil', exigirLogin, async (req, res, next) => {
  try {
    const campos = {};
    const { nome, telefone } = validarPerfil(req.body, campos);
    if (Object.keys(campos).length > 0) return invalido(res, campos);

    const resultado = await query(
      'UPDATE organizador SET nome = $1, telefone = $2 WHERE id = $3 RETURNING id, nome, email, telefone',
      [nome, telefone, req.organizador.id],
    );
    res.json(formatarOrganizador(resultado.rows[0]));
  } catch (erro) {
    next(erro);
  }
});

// PUT /api/auth/senha  { senhaAtual, novaSenha } — encerra as outras sessões.
router.put('/senha', exigirLogin, async (req, res, next) => {
  try {
    const campos = {};
    const novaSenha = validarSenha(req.body?.novaSenha, campos, 'novaSenha');
    if (Object.keys(campos).length > 0) return invalido(res, campos);

    const atual = await query('SELECT senha_hash FROM organizador WHERE id = $1', [req.organizador.id]);
    if (!(await conferirSenha(req.body?.senhaAtual ?? '', atual.rows[0]?.senha_hash))) {
      return invalido(res, { senhaAtual: 'Senha atual incorreta.' });
    }

    await query(
      `WITH alterado AS (
         UPDATE organizador SET senha_hash = $1 WHERE id = $2 RETURNING id
       )
       DELETE FROM sessao WHERE organizador_id IN (SELECT id FROM alterado) AND token_hash <> $3`,
      [await gerarHashSenha(novaSenha), req.organizador.id, hashToken(req.tokenSessao)],
    );
    res.status(204).end();
  } catch (erro) {
    next(erro);
  }
});

// POST /api/auth/recuperar-senha  { email }
// Responde sempre da mesma forma, exista ou não a conta.
router.post(
  '/recuperar-senha',
  limitarTentativas({ nome: 'recuperar', maximo: 5, janelaMs: QUINZE_MINUTOS }),
  async (req, res, next) => {
    try {
      const campos = {};
      const email = validarEmail(req.body?.email, campos);
      if (Object.keys(campos).length > 0) return invalido(res, campos);

      const resultado = await query('SELECT id, nome FROM organizador WHERE email = $1', [email]);
      if (resultado.rowCount > 0) {
        const { id, nome } = resultado.rows[0];
        const token = gerarToken();
        await query(
          `INSERT INTO recuperacao_senha (token_hash, organizador_id, expira_em)
           VALUES ($1, $2, NOW() + make_interval(mins => $3))`,
          [hashToken(token), id, VALIDADE_RECUPERACAO_MIN],
        );
        const base = process.env.APP_URL || 'http://localhost:8080';
        try {
          await correio.enviar({
            para: email,
            assunto: 'GoBeach: redefinição de senha',
            texto:
              `Olá, ${nome}!\n\n` +
              `Recebemos um pedido para redefinir a senha da sua conta de organizador no GoBeach.\n` +
              `Para criar uma nova senha, acesse o link abaixo (válido por ${VALIDADE_RECUPERACAO_MIN} minutos):\n\n` +
              `${base}/redefinir-senha?token=${token}\n\n` +
              `Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.`,
          });
        } catch (erroEnvio) {
          console.error('Falha ao enviar e-mail de recuperação:', erroEnvio);
        }
      }

      res.status(202).json({
        mensagem: 'Se houver uma conta com este e-mail, enviaremos um link para redefinir a senha.',
      });
    } catch (erro) {
      next(erro);
    }
  },
);

// POST /api/auth/redefinir-senha  { token, novaSenha }
// O link é de uso único; ao redefinir, todas as sessões abertas são encerradas.
router.post('/redefinir-senha', async (req, res, next) => {
  try {
    const campos = {};
    const novaSenha = validarSenha(req.body?.novaSenha, campos, 'novaSenha');
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    if (!token) return res.status(400).json({ erro: 'Link de redefinição inválido ou expirado.' });
    if (Object.keys(campos).length > 0) return invalido(res, campos);

    const resultado = await query(
      `WITH usado AS (
         UPDATE recuperacao_senha SET usado_em = NOW()
         WHERE token_hash = $1 AND usado_em IS NULL AND expira_em > NOW()
         RETURNING organizador_id
       ), alterado AS (
         UPDATE organizador SET senha_hash = $2
         WHERE id IN (SELECT organizador_id FROM usado)
         RETURNING id
       ), encerradas AS (
         DELETE FROM sessao WHERE organizador_id IN (SELECT id FROM alterado)
       )
       SELECT id FROM alterado`,
      [hashToken(token), await gerarHashSenha(novaSenha)],
    );
    if (resultado.rowCount === 0) {
      return res.status(400).json({ erro: 'Link de redefinição inválido ou expirado.' });
    }
    res.json({ mensagem: 'Senha redefinida. Faça login com a nova senha.' });
  } catch (erro) {
    next(erro);
  }
});

export default router;
