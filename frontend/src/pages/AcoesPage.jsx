import { AcaoCard } from '../components/AtividadeCards.jsx';
import { Carregando, Erro, Vazio } from '../components/Estado.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';

const INTERVALO_ATUALIZACAO_MS = 10000;

// PBI-05 Consultar Ações Comunitárias (contador de voluntários atualizado periodicamente)
export default function AcoesPage() {
  const { dados, erro, carregando } = useDados(
    () => api.listarAtividades('ACAO_COMUNITARIA'),
    [],
    INTERVALO_ATUALIZACAO_MS,
  );

  return (
    <>
      <div className="titulo-pagina">
        <h1>Ações comunitárias</h1>
        <p>Mutirões de limpeza e preservação da orla. Junte-se aos voluntários!</p>
      </div>

      {erro && <Erro erro={erro} />}
      {carregando && !dados && <Carregando />}
      {dados && dados.dados.length === 0 && <Vazio>Nenhuma ação agendada.</Vazio>}
      {dados && dados.dados.length > 0 && (
        <div className="grade">
          {dados.dados.map((acao) => (
            <AcaoCard key={acao.id} acao={acao} />
          ))}
        </div>
      )}
    </>
  );
}
