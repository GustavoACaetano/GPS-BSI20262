import { Link, useNavigate, useParams } from 'react-router-dom';
import FormularioAula, { aulaParaFormulario } from '../components/FormularioAula.jsx';
import { Carregando, Erro } from '../components/Estado.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';

// PBI-06 + PBI-11: o organizador logado edita uma aula que ele mesmo cadastrou.
export default function EditarAulaPage() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { dados: aula, erro, carregando } = useDados(() => api.obterMinhaAtividade(id), [id]);

  if (erro) return <Erro erro={erro} />;
  if (carregando && !aula) return <Carregando />;
  if (aula.tipo !== 'AULA') return <Erro erro={new Error('Somente aulas podem ser editadas aqui.')} />;

  const salvar = async (valores) => {
    const salva = await api.editarAula(id, valores);
    navegar(salva.publicada ? `/atividades/${id}` : '/minha-area');
  };

  return (
    <section className="detalhe">
      <Link to="/minha-area" className="voltar">← Minha área</Link>
      <div className="titulo-pagina">
        <h1>Editar aula</h1>
        <p>Atualize horários, local ou contato para manter seus alunos informados.</p>
      </div>
      <FormularioAula inicial={aulaParaFormulario(aula)} rotuloEnviar="Salvar alterações" aoEnviar={salvar} />
    </section>
  );
}
