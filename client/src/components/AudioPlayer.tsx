import type { EpisodeRecord } from "../api";

interface Props {
  episode: EpisodeRecord | null;
}

export function AudioPlayer({ episode }: Props) {
  if (!episode || episode.status !== "Completed" || !episode.finalAudioUrl) {
    return null;
  }

  return (
    <section className="panel">
      <h2>4. Listen</h2>
      <audio controls src={episode.finalAudioUrl} style={{ width: "100%" }} />
      <a
        className="download-link"
        href={episode.finalAudioUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        ⬇ Download MP3
      </a>
    </section>
  );
}
