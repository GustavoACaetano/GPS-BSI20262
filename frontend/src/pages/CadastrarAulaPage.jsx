import { useState } from 'react';
import { Link } from 'react-router-dom';
import FormularioAula from '../components/FormularioAula.jsx';
import { api } from '../api.js';
import { salvarCodigoEdicao } from '../codigosEdicao.js';

// PBI-06 Cadastrar e Publicar Aulas Esportivas
export default function CadastrarAulaPage() {
  const [resultado, setResultado] = useState(null);

  const cadastrar = async (valores) => {
    const resposta = await api.cadastrarAula(valores);
    salvarCodigoEdicao(resposta.aula.id, resposta.codigoEdicao);
    setResultado(resposta);
  };

  if (resultado) {
    const { aula, publicada, codigoEdicao } = resultado;
    return (
      <section className="detalhe">
        <div className="painel painel--propria" role="status">
          <h1>{publicada ? 'Aula publicada!' : 'Aula enviada para aprovação'}</h1>
          <p>
            {publicada
              ? `"${aula.titulo}" já aparece na aba Aulas para todos os visitantes.`
              : `"${aula.titulo}" ficará visível assim que a equipe GoBeach aprovar o cadastro.`}
          </p>
        </div>

        <div className="painel painel--neutro">
          <h2>Guarde seu código de edição</h2>
          <p>Você vai precisar dele para alterar os dados desta aula. Ele não será mostrado de novo.</p>
          <code className="codigo">{codigoEdicao}</code>
          <p className="texto-suave">Neste navegador, o código fica salvo e é preenchido automaticamente.</p>
        </div>

        <div className="acoes">
          {publicada && (
            <Link to={`/atividades/${aula.id}`} className="botao">
              Ver aula publicada
            </Link>
          )}
          {publicada && (
            <Link to={`/aulas/${aula.id}/editar`} className="botao botao--secundario">
              Editar aula
            </Link>
          )}
          <button type="button" className="botao botao--secundario" onClick={() => setResultado(null)}>
            Cadastrar outra aula
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="detalhe">
      <Link to="/aulas" className="voltar">← Todas as aulas</Link>
      <div className="titulo-pagina">
        <h1>Cadastrar aula</h1>
        <p>Divulgue sua aula na praia e atraia novos alunos. Campos com * são obrigatórios.</p>
      </div>
      <FormularioAula rotuloEnviar="Publicar aula" aoEnviar={cadastrar} />
    </section>
  );
}
