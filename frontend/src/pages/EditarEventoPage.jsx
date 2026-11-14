import { Link, useNavigate, useParams } from 'react-router-dom';
import FormularioEvento, { eventoParaFormulario } from '../components/FormularioEvento.jsx';
import { Carregando, Erro } from '../components/Estado.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';

// PBI-07 + PBI-11: o organizador logado edita um evento que ele mesmo cadastrou.
export default function EditarEventoPage() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { dados: evento, erro, carregando } = useDados(() => api.obterMinhaAtividade(id), [id]);

  if (erro) return <Erro erro={erro} />;
  if (carregando && !evento) return <Carregando />;
  if (evento.tipo !== 'EVENTO') {
    return <Erro erro={new Error('Somente eventos esportivos podem ser editados aqui.')} />;
  }

  const salvar = async (valores) => {
    const salvo = await api.editarEvento(id, valores);
    navegar(salvo.publicada ? `/atividades/${id}` : '/minha-area');
  };

  return (
    <section className="detalhe">
      <Link to="/minha-area" className="voltar">← Minha área</Link>
      <div className="titulo-pagina">
        <h1>Editar evento esportivo</h1>
        <p>Atualize data, regulamento, vagas ou contato para manter os inscritos informados.</p>
      </div>
      <FormularioEvento inicial={eventoParaFormulario(evento)} rotuloEnviar="Salvar alterações" aoEnviar={salvar} />
    </section>
  );
}
