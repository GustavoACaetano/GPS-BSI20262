import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import FormularioAula, { aulaParaFormulario } from '../components/FormularioAula.jsx';
import { Carregando, Erro } from '../components/Estado.jsx';
import { api } from '../api.js';
import { obterCodigoEdicao, salvarCodigoEdicao } from '../codigosEdicao.js';
import { useDados } from '../hooks.js';

// PBI-06: o instrutor edita a própria aula informando o código de edição.
export default function EditarAulaPage() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [codigo, setCodigo] = useState(() => obterCodigoEdicao(id));
  const { dados: aula, erro, carregando } = useDados(() => api.obterAtividade(id), [id]);

  if (erro) return <Erro erro={erro} />;
  if (carregando && !aula) return <Carregando />;
  if (aula.tipo !== 'AULA') return <Erro erro={new Error('Somente aulas podem ser editadas aqui.')} />;

  const salvar = async (valores) => {
    if (!codigo.trim()) {
      throw Object.assign(new Error('Informe o código de edição.'), { campos: {} });
    }
    await api.editarAula(id, valores, codigo.trim());
    salvarCodigoEdicao(id, codigo.trim());
    navegar(`/atividades/${id}`);
  };

  return (
    <section className="detalhe">
      <Link to={`/atividades/${id}`} className="voltar">← Voltar para a aula</Link>
      <div className="titulo-pagina">
        <h1>Editar aula</h1>
        <p>Atualize horários, local ou contato para manter seus alunos informados.</p>
      </div>
      <FormularioAula inicial={aulaParaFormulario(aula)} rotuloEnviar="Salvar alterações" aoEnviar={salvar}>
        <fieldset>
          <legend>Código de edição</legend>
          <div className="campo">
            <label htmlFor="codigoEdicao">
              Código recebido no cadastro<span className="obrigatorio" aria-hidden="true"> *</span>
            </label>
            <input
              id="codigoEdicao"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </fieldset>
      </FormularioAula>
    </section>
  );
}
