import { useState } from 'react';
import { Link } from 'react-router-dom';
import FormularioAula, { AULA_VAZIA } from '../components/FormularioAula.jsx';
import { api } from '../api.js';
import { useSessao } from '../sessao.jsx';

// PBI-06 Cadastrar e Publicar Aulas Esportivas (exige login do PBI-11)
export default function CadastrarAulaPage() {
  const { organizador } = useSessao();
  const [aula, setAula] = useState(null);

  if (aula) {
    return (
      <section className="detalhe">
        <div className="painel painel--propria" role="status">
          <h1>{aula.publicada ? 'Aula publicada!' : 'Aula enviada para aprovação'}</h1>
          <p>
            {aula.publicada
              ? `"${aula.titulo}" já aparece na aba Aulas para todos os visitantes.`
              : `"${aula.titulo}" ficará visível assim que a equipe GoBeach aprovar o cadastro.`}
          </p>
          <p className="texto-suave">Você pode editá-la quando quiser em Minha área.</p>
        </div>

        <div className="acoes">
          {aula.publicada && (
            <Link to={`/atividades/${aula.id}`} className="botao">
              Ver aula publicada
            </Link>
          )}
          <Link to="/minha-area" className="botao botao--secundario">
            Ir para Minha área
          </Link>
          <button type="button" className="botao botao--secundario" onClick={() => setAula(null)}>
            Cadastrar outra aula
          </button>
        </div>
      </section>
    );
  }

  // Sugere o próprio organizador como instrutor e contato.
  const inicial = {
    ...AULA_VAZIA,
    instrutor: organizador.nome,
    contato: organizador.telefone || organizador.email,
  };

  return (
    <section className="detalhe">
      <Link to="/aulas" className="voltar">← Todas as aulas</Link>
      <div className="titulo-pagina">
        <h1>Cadastrar aula</h1>
        <p>Divulgue sua aula na praia e atraia novos alunos. Campos com * são obrigatórios.</p>
      </div>
      <FormularioAula
        inicial={inicial}
        rotuloEnviar="Publicar aula"
        aoEnviar={async (valores) => setAula(await api.cadastrarAula(valores))}
      />
    </section>
  );
}
