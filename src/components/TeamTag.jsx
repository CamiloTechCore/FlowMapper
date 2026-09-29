import '../styles/team-tag.css';

export default function TeamTag({ team }) {
  return team?.etiqueta ? <span className="team-tag" title={`Etiqueta del equipo ${team.nombre}`}>{team.etiqueta}</span> : null;
}
