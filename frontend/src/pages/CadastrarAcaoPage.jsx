import { useState } from 'react';
import { Link } from 'react-router-dom';
import FormularioAcao, { ACAO_VAZIA } from '../components/FormularioAcao.jsx';
import { api } from '../api.js';
import { useSessao } from '../sessao.jsx';

// PBI-08 Cadastrar Ações Comunitárias (exige login do PBI-11)
export default function CadastrarAcaoPage() {
  const { organizador } = useSessao();
  const [acao, setAcao] = useState(null);

  if (acao) {
    return (
      <section className="detalhe">
        <div className="painel painel--propria" role="status">
          <h1>{acao.publicada ? 'Ação publicada!' : 'Ação enviada para aprovação'}</h1>
          <p>
            {acao.publicada
              ? `"${acao.titulo}" já aparece na aba Ações para mobilizar voluntários.`
              : `"${acao.titulo}" ficará visível assim que a equipe GoBeach aprovar o cadastro.`}
          </p>
          <p className="texto-suave">Você pode editá-la quando quiser em Minha área.</p>
        </div>

        <div className="acoes">
          {acao.publicada && (
            <Link to={`/atividades/${acao.id}`} className="botao">
              Ver ação publicada
            </Link>
          )}
          <Link to="/minha-area" className="botao botao--secundario">
            Ir para Minha área
          </Link>
          <button type="button" className="botao botao--secundario" onClick={() => setAcao(null)}>
            Cadastrar outra ação
          </button>
        </div>
      </section>
    );
  }

  // O organizador logado é sugerido como responsável pela ação.
  const inicial = {
    ...ACAO_VAZIA,
    responsavel: organizador.nome,
    contato: organizador.telefone || organizador.email,
  };

  return (
    <section className="detalhe">
      <Link to="/acoes" className="voltar">← Todas as ações</Link>
      <div className="titulo-pagina">
        <h1>Cadastrar ação comunitária</h1>
        <p>Publique um mutirão ambiental e mobilize voluntários. Campos com * são obrigatórios.</p>
      </div>
      <FormularioAcao
        inicial={inicial}
        rotuloEnviar="Publicar ação"
        aoEnviar={async (valores) => setAcao(await api.cadastrarAcao(valores))}
      />
    </section>
  );
}
