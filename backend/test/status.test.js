import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, mockarBanco, linhas, sessaoDe, AUTH } from './helpers.js';
import { correio } from '../src/email.js';
import { mensagemStatus, notificarInscritos } from '../src/notificacoes.js';

// PBI-12: Atualizar Status ou Cancelar Atividade.

let api;
before(async () => {
  api = await iniciarServidor();
});
after(() => api.fechar());
afterEach(() => mock.restoreAll());

const LIGA = { id: 3, nome: 'Liga', email: 'liga@exemplo.com', telefone: null };
const AVISO = 'Adiado por causa da ressaca. Nova data em breve.';

const atual = (extras = {}) => linhas([{ tipo: 'EVENTO', status: 'ATIVO', organizador_id: 3, realizada: false, ...extras }]);
const gravada = (extras = {}) => linhas([{
  id: 60, tipo: 'EVENTO', titulo: 'Open de Vôlei', descricao: null, status: 'ADIADO', aviso_status: AVISO,
  status_alterado_em: new Date('2026-11-14T15:00:00Z'), responsavel: 'Liga', contato: 'x', praia_id: 1,
  praia_nome: 'Camburi', praia_municipio: 'Vitória', local_detalhe: 'Quadra', interessados: 2, modalidade: 'Vôlei',
  data_inicio: new Date('2026-12-05T12:00:00Z'), gratuito: true, valor_inscricao: null, regulamento: 'R',
  limite_vagas: null, publicada: true, organizador_id: 3, ...extras,
}]);
const inscritos = linhas([
  { nome: 'Bia', contato: 'bia@exemplo.com' },
  { nome: 'Caio', contato: '(27) 99999-1234' },
]);

test('adia a atividade com aviso e avisa por e-mail os inscritos que deixaram e-mail', async () => {
  const enviar = mock.method(correio, 'enviar', async () => {});
  const consulta = mockarBanco(sessaoDe(LIGA), atual(), gravada(), inscritos);

  const { status, corpo } = await api.patch('/api/atividades/60/status', { status: 'ADIADO', aviso: ` ${AVISO} ` }, AUTH);

  assert.equal(status, 200);
  assert.equal(corpo.atividade.status, 'ADIADO');
  assert.equal(corpo.atividade.avisoStatus, AVISO);
  assert.equal(corpo.atividade.statusAlteradoEm, '2026-11-14T15:00:00.000Z');
  assert.equal(corpo.avisados, 1);

  const [sql, parametros] = consulta.mock.calls[2].arguments;
  assert.match(sql, /SET status = \$1, aviso_status = \$2, status_alterado_em = NOW\(\)/);
  assert.match(sql, /status <> 'CANCELADO'/);
  assert.deepEqual(parametros, ['ADIADO', AVISO, 60, 3]);

  await new Promise((r) => setImmediate(r));
  assert.equal(enviar.mock.callCount(), 1);
  assert.equal(enviar.mock.calls[0].arguments[0].para, 'bia@exemplo.com');
  assert.match(enviar.mock.calls[0].arguments[0].assunto, /foi adiada/);
});

test('reativar uma atividade adiada limpa o aviso e não envia e-mails', async () => {
  const enviar = mock.method(correio, 'enviar', async () => {});
  const consulta = mockarBanco(sessaoDe(LIGA), atual({ status: 'ADIADO' }), gravada({ status: 'ATIVO', aviso_status: null }));

  const { status, corpo } = await api.patch('/api/atividades/60/status', { status: 'ATIVO' }, AUTH);

  assert.equal(status, 200);
  assert.equal(corpo.atividade.avisoStatus, null);
  assert.equal(corpo.avisados, 0);
  assert.deepEqual(consulta.mock.calls[2].arguments[1], ['ATIVO', null, 60, 3]);
  assert.equal(consulta.mock.callCount(), 3);
  assert.equal(enviar.mock.callCount(), 0);
});

test('adiar ou cancelar exige aviso de 5 a 300 caracteres', async () => {
  const consulta = mockarBanco(sessaoDe(LIGA), sessaoDe(LIGA));

  const curto = await api.patch('/api/atividades/60/status', { status: 'CANCELADO', aviso: 'ok' }, AUTH);
  const longo = await api.patch('/api/atividades/60/status', { status: 'ADIADO', aviso: 'x'.repeat(301) }, AUTH);

  assert.equal(curto.status, 400);
  assert.ok(curto.corpo.campos.aviso);
  assert.equal(longo.status, 400);
  assert.equal(consulta.mock.callCount(), 2); // só as verificações de sessão
});

test('status inválido é recusado', async () => {
  mockarBanco(sessaoDe(LIGA));

  const { status, corpo } = await api.patch('/api/atividades/60/status', { status: 'SUSPENSO', aviso: AVISO }, AUTH);

  assert.equal(status, 400);
  assert.match(corpo.campos.status, /ATIVO, ADIADO, CANCELADO/);
});

test('exige login e ser o organizador dono', async () => {
  mockarBanco();
  const semLogin = await api.patch('/api/atividades/60/status', { status: 'ADIADO', aviso: AVISO });
  assert.equal(semLogin.status, 401);

  mock.restoreAll();
  mockarBanco(sessaoDe(LIGA), atual({ organizador_id: 9 }));
  const outro = await api.patch('/api/atividades/60/status', { status: 'ADIADO', aviso: AVISO }, AUTH);
  assert.equal(outro.status, 403);
});

for (const [situacao, linha, corpo, mensagem] of [
  ['cancelada (definitivo)', { status: 'CANCELADO' }, { status: 'ATIVO' }, /definitivo/],
  ['já realizada', { realizada: true }, { status: 'CANCELADO', aviso: AVISO }, /já aconteceu/],
  ['já ativa', { status: 'ATIVO' }, { status: 'ATIVO' }, /já está ativa/],
]) {
  test(`recusa alterar atividade ${situacao}`, async () => {
    mockarBanco(sessaoDe(LIGA), atual(linha));

    const { status, corpo: resposta } = await api.patch('/api/atividades/60/status', corpo, AUTH);

    assert.equal(status, 409);
    assert.match(resposta.erro, mensagem);
  });
}

test('atividade inexistente responde 404', async () => {
  mockarBanco(sessaoDe(LIGA), linhas([]));

  const { status } = await api.patch('/api/atividades/999/status', { status: 'ADIADO', aviso: AVISO }, AUTH);

  assert.equal(status, 404);
});

test('atividade cancelada não pode ser editada', async () => {
  mockarBanco(sessaoDe(LIGA), linhas([{ tipo: 'EVENTO', organizador_id: 3, status: 'CANCELADO' }]));

  const { status, corpo } = await api.put('/api/atividades/eventos/60', {}, AUTH);

  assert.equal(status, 409);
  assert.match(corpo.erro, /canceladas não podem ser editadas/);
});

test('consultas públicas expõem o aviso de status', async () => {
  mockarBanco(gravada());

  const { corpo } = await api.get('/api/atividades?tipo=EVENTO');

  assert.equal(corpo.dados[0].avisoStatus, AVISO);
  assert.equal(corpo.dados[0].status, 'ADIADO');
});

test('notificarInscritos envia só para e-mails e segue mesmo se um envio falhar', async () => {
  mock.method(console, 'error', () => {});
  const enviar = mock.method(correio, 'enviar', async ({ para }) => {
    if (para === 'falha@exemplo.com') throw new Error('SMTP');
  });

  const enviados = await notificarInscritos({ id: 60, titulo: 'Open' }, 'CANCELADO', AVISO, [
    { nome: 'A', contato: 'falha@exemplo.com' },
    { nome: 'B', contato: '27999991234' },
    { nome: 'C', contato: 'c@exemplo.com' },
  ]);

  assert.equal(enviados, 1);
  assert.equal(enviar.mock.callCount(), 2);
});

test('notificarInscritos tenta de novo em falhas temporárias (SMTP 4xx), mas não em permanentes', async () => {
  mock.method(console, 'error', () => {});
  const tentativas = {};
  mock.method(correio, 'enviar', async ({ para }) => {
    tentativas[para] = (tentativas[para] || 0) + 1;
    if (para === 'ocupado@exemplo.com' && tentativas[para] < 3) {
      throw Object.assign(new Error('451 Unable to process mail'), { responseCode: 451 });
    }
    if (para === 'inexistente@exemplo.com') {
      throw Object.assign(new Error('550 No such user'), { responseCode: 550 });
    }
    if (para === 'sempre-ocupado@exemplo.com') {
      throw Object.assign(new Error('421 Try later'), { responseCode: 421 });
    }
  });
  const esperas = [];
  const esperar = async (ms) => esperas.push(ms);

  const enviados = await notificarInscritos({ id: 60, titulo: 'Open' }, 'ADIADO', AVISO, [
    { nome: 'A', contato: 'ocupado@exemplo.com' },
    { nome: 'B', contato: 'inexistente@exemplo.com' },
    { nome: 'C', contato: 'sempre-ocupado@exemplo.com' },
  ], { esperar });

  assert.equal(enviados, 1);
  assert.deepEqual(tentativas, { 'ocupado@exemplo.com': 3, 'inexistente@exemplo.com': 1, 'sempre-ocupado@exemplo.com': 3 });
  assert.deepEqual(esperas, [1000, 3000, 1000, 3000]);
});

test('mensagemStatus inclui o aviso e o link da atividade', () => {
  const { assunto, texto } = mensagemStatus({ id: 60, titulo: 'Open' }, 'CANCELADO', AVISO, 'Bia');

  assert.equal(assunto, 'GoBeach: "Open" foi cancelada');
  assert.match(texto, /Olá, Bia!/);
  assert.match(texto, new RegExp(AVISO));
  assert.match(texto, /\/atividades\/60/);
});
