import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TagBalneabilidade } from './Balneabilidade.jsx';
import { formatarDataHora } from '../formatacao.js';

// Centro aproximado da Grande Vitória, usado quando não há praias para enquadrar.
const CENTRO_PADRAO = [-20.35, -40.3];

function classeMarcador(boletim) {
  if (!boletim) return 'marcador--neutro';
  if (boletim.pendenteAtualizacao) return 'marcador--alerta';
  return boletim.status === 'PROPRIA' ? 'marcador--propria' : 'marcador--impropria';
}

// Ícone em HTML/CSS: evita depender das imagens padrão do Leaflet no build do Vite.
const icone = (boletim) =>
  L.divIcon({
    className: '',
    html: `<span class="marcador ${classeMarcador(boletim)}"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  });

// Reenquadra o mapa sempre que a busca ou o filtro mudam o conjunto de praias.
function Enquadrar({ praias }) {
  const mapa = useMap();
  useEffect(() => {
    if (praias.length === 0) return;
    const limites = L.latLngBounds(praias.map((p) => [p.latitude, p.longitude]));
    mapa.fitBounds(limites, { padding: [40, 40], maxZoom: 14 });
  }, [mapa, praias]);
  return null;
}

export default function MapaPraias({ praias }) {
  const marcadores = useMemo(
    () => praias.map((praia) => ({ praia, icone: icone(praia.balneabilidade) })),
    [praias],
  );

  return (
    <div className="mapa">
      <MapContainer center={CENTRO_PADRAO} zoom={10} scrollWheelZoom className="mapa__canvas">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Enquadrar praias={praias} />
        {marcadores.map(({ praia, icone: iconePraia }) => (
          <Marker
            key={praia.id}
            position={[praia.latitude, praia.longitude]}
            icon={iconePraia}
            title={praia.nome}
          >
            <Popup>
              <div className="popup">
                <strong>{praia.nome}</strong>
                <span className="card__subtitulo">{praia.municipio}</span>
                <TagBalneabilidade boletim={praia.balneabilidade} />
                {praia.balneabilidade && (
                  <small>
                    {praia.balneabilidade.fonte} · {formatarDataHora(praia.balneabilidade.dataBoletim)}
                  </small>
                )}
                <Link to={`/praias/${praia.id}`}>Ver detalhes da praia →</Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <ul className="mapa__legenda" aria-label="Legenda">
        <li><span className="marcador marcador--propria" /> Própria</li>
        <li><span className="marcador marcador--impropria" /> Imprópria</li>
        <li><span className="marcador marcador--alerta" /> Boletim com mais de 7 dias</li>
        <li><span className="marcador marcador--neutro" /> Sem boletim</li>
      </ul>
    </div>
  );
}
