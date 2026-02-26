import { useState, useEffect, useRef } from "react";
import { api, type ScriptTurn, type EpisodeRecord, type EpisodeStatus } from "../api";

interface Props {
  title: string;
  script: ScriptTurn[];
  onComplete: (episode: EpisodeRecord) => void;
}

const STATUS_STEPS: EpisodeStatus[] = ["Queued", "Synthesizing", "Stitching", "Completed"];

function statusProgress(status: EpisodeStatus): number {
  const idx = STATUS_STEPS.indexOf(status);
  if (status === "Failed") return -1;
  return idx >= 0 ? ((idx + 1) / STATUS_STEPS.length) * 100 : 0;
}

export function SynthesisPanel({ title, script, onComplete }: Props) {
  const [introUrl, setIntroUrl] = useState("");
  const [outroUrl, setOutroUrl] = useState("");
  const [episode, setEpisode] = useState<EpisodeRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  const startSynthesis = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await api.createEpisode({
        title: title || undefined,
        script,
        introMusicUrl: introUrl || undefined,
        outroMusicUrl: outroUrl || undefined,
      });

      const initial = await api.getEpisode(result.episodeId);
      setEpisode(initial);

      pollRef.current = setInterval(async () => {
        try {
          const updated = await api.getEpisode(result.episodeId);
          setEpisode(updated);
          if (updated.status === "Completed" || updated.status === "Failed") {
            stopPolling();
            if (updated.status === "Completed") onComplete(updated);
          }
        } catch {
          // keep polling on transient errors
        }
      }, 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start synthesis");
    } finally {
      setLoading(false);
    }
  };

  const progress = episode ? statusProgress(episode.status) : 0;
  const isRunning = episode && !["Completed", "Failed"].includes(episode.status);

  return (
    <section className="panel">
      <h2>3. Synthesize</h2>
      <div className="form-row">
        <label>
          Intro music URL <span className="muted">(optional, https)</span>
          <input
            value={introUrl}
            onChange={(e) => setIntroUrl(e.target.value)}
            placeholder="https://..."
            disabled={!!isRunning}
          />
        </label>
        <label>
          Outro music URL <span className="muted">(optional, https)</span>
          <input
            value={outroUrl}
            onChange={(e) => setOutroUrl(e.target.value)}
            placeholder="https://..."
            disabled={!!isRunning}
          />
        </label>
      </div>
      <button
        onClick={startSynthesis}
        disabled={loading || !!isRunning || script.length < 2}
      >
        {loading ? "Starting…" : isRunning ? "Synthesizing…" : "Start Synthesis"}
      </button>

      {episode && (
        <div className="progress-section">
          <div className="progress-bar-track">
            <div
              className={`progress-bar-fill ${episode.status === "Failed" ? "failed" : ""}`}
              style={{ width: `${progress >= 0 ? progress : 100}%` }}
            />
          </div>
          <p className={`status-label ${episode.status.toLowerCase()}`}>
            {episode.status}
            {episode.status === "Failed" && episode.error && `: ${episode.error}`}
          </p>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
