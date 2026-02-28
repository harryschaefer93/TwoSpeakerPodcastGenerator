import type { EpisodeRecord } from "../api";

interface Props {
  episodes: EpisodeRecord[];
  onSelect: (episode: EpisodeRecord) => void;
}

const statusBadgeClass = (status: string): string => {
  switch (status) {
    case "Completed": return "badge completed";
    case "Failed": return "badge failed";
    case "Synthesizing":
    case "Stitching": return "badge in-progress";
    default: return "badge";
  }
};

export function EpisodeHistory({ episodes, onSelect }: Props) {
  if (episodes.length === 0) return null;

  return (
    <section className="panel">
      <h2>Episode History</h2>
      <ul className="episode-list">
        {episodes.map((ep) => (
          <li key={ep.id} className="episode-item" onClick={() => onSelect(ep)}>
            <span className="episode-title">{ep.title}</span>
            <span className={statusBadgeClass(ep.status)}>{ep.status}</span>
            <span className="muted">{new Date(ep.createdAt).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
