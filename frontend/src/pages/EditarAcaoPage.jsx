import { Link, useNavigate, useParams } from 'react-router-dom';
import FormularioAcao, { acaoParaFormulario } from '../components/FormularioAcao.jsx';
import { Carregando, Erro } from '../components/Estado.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';

// PBI-08 + PBI-11: o organizador logado edita uma ação que ele mesmo cadastrou.
export default function EditarAcaoPage() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { dados: acao, erro, carregando } = useDados(() => api.obterMinhaAtividade(id), [id]);

  if (erro) return <Erro erro={erro} />;
  if (carregando && !acao) return <Carregando />;
  if (acao.tipo !== 'ACAO_COMUNITARIA') {
    return <Erro erro={new Error('Somente ações comunitárias podem ser editadas aqui.')} />;
  }

  const salvar = async (valores) => {
    const salva = await api.editarAcao(id, valores);
    navegar(salva.publicada ? `/atividades/${id}` : '/minha-area');
  };

  return (
    <section className="detalhe">
      <Link to="/minha-area" className="voltar">← Minha área</Link>
      <div className="titulo-pagina">
        <h1>Editar ação comunitária</h1>
        <p>Atualize data, ponto de encontro ou recomendações para manter os voluntários informados.</p>
      </div>
      <FormularioAcao inicial={acaoParaFormulario(acao)} rotuloEnviar="Salvar alterações" aoEnviar={salvar} />
    </section>
  );
}
