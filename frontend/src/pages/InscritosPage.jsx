import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Carregando, Erro, Vazio } from '../components/Estado.jsx';
import { api } from '../api.js';
import { useDados } from '../hooks.js';
import { formatarDataHora } from '../formatacao.js';

// Link direto para falar com o inscrito: e-mail ou WhatsApp (wa.me exige DDI 55 + DDD + número).
export function linkContato(contato) {
  if (contato.includes('@')) return `mailto:${contato}`;
  const digitos = contato.replace(/\D/g, '');
  return `https://wa.me/${digitos.startsWith('55') && digitos.length > 11 ? digitos : `55${digitos}`}`;
}

// PBI-10: o organizador dono vê quem se inscreveu na atividade (registros de participação).
export default function InscritosPage() {
  const { id } = useParams();
  const { dados, erro, carregando } = useDados(() => api.listarInscritos(id), [id], 30000);
  const [copiado, setCopiado] = useState(null);

  if (erro) return <Erro erro={erro} />;
  if (carregando && !dados) return <Carregando />;

  const { atividade, dados: inscritos } = dados;

  const copiarContatos = async () => {
    try {
      await navigator.clipboard.writeText(inscritos.map((i) => `${i.nome} - ${i.contato}`).join('\n'));
      setCopiado('Contatos copiados.');
    } catch {
      setCopiado('Não foi possível copiar. Selecione a tabela e copie manualmente.');
    }
  };

  return (
    <section className="detalhe">
      <Link to="/minha-area" className="voltar">← Minha área</Link>
      <div className="titulo-pagina">
        <h1>Inscritos</h1>
        <p>
          {atividade.titulo} · <strong>{atividade.inscritos}</strong>
          {atividade.limiteVagas ? ` de ${atividade.limiteVagas} vagas preenchidas` : ` ${atividade.inscritos === 1 ? 'inscrito' : 'inscritos'}`}
        </p>
      </div>

      {inscritos.length === 0 ? (
        <Vazio>Ainda não há inscritos nesta atividade.</Vazio>
      ) : (
        <>
          <div className="acoes">
            <button type="button" className="botao botao--secundario" onClick={copiarContatos}>
              Copiar contatos
            </button>
            {copiado && <span className="texto-suave" role="status">{copiado}</span>}
          </div>
          <div className="tabela-rolagem">
            <table className="tabela-inscritos">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Nome</th>
                  <th scope="col">Contato</th>
                  <th scope="col">Inscrição</th>
                </tr>
              </thead>
              <tbody>
                {inscritos.map((inscrito, i) => (
                  <tr key={inscrito.id}>
                    <td>{i + 1}</td>
                    <td>{inscrito.nome}</td>
                    <td>
                      <a href={linkContato(inscrito.contato)} target="_blank" rel="noreferrer">
                        {inscrito.contato}
                      </a>
                    </td>
                    <td>{formatarDataHora(inscrito.criadoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="texto-suave">
            Use estes contatos apenas para assuntos desta atividade: os inscritos autorizaram o envio só ao organizador.
          </p>
        </>
      )}
    </section>
  );
}
