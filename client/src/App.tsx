import { useState } from "react";
import type { ScriptTurn, ScriptGenerationResponse, EpisodeRecord } from "./api";
import { ScriptGenerator } from "./components/ScriptGenerator";
import { ScriptEditor } from "./components/ScriptEditor";
import { SynthesisPanel } from "./components/SynthesisPanel";
import { AudioPlayer } from "./components/AudioPlayer";
import { EpisodeHistory } from "./components/EpisodeHistory";
import "./App.css";

function App() {
  const [title, setTitle] = useState("");
  const [script, setScript] = useState<ScriptTurn[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<EpisodeRecord | null>(null);
  const [history, setHistory] = useState<EpisodeRecord[]>([]);

  const handleGenerated = (result: ScriptGenerationResponse) => {
    setTitle(result.title);
    setScript(result.script);
    setCurrentEpisode(null);
  };

  const handleScriptUpdate = (newTitle: string, newScript: ScriptTurn[]) => {
    setTitle(newTitle);
    setScript(newScript);
  };

  const handleComplete = (episode: EpisodeRecord) => {
    setCurrentEpisode(episode);
    setHistory((prev) =>
      prev.some((e) => e.id === episode.id) ? prev : [episode, ...prev]
    );
  };

  const handleSelectEpisode = (episode: EpisodeRecord) => {
    setCurrentEpisode(episode);
    setTitle(episode.title);
    setScript(episode.script);
  };

  return (
    <div className="app">
      <header>
        <h1>🎙️ PodcastGen</h1>
        <p className="muted">Generate → Edit → Synthesize → Listen</p>
      </header>

      <ScriptGenerator onGenerated={handleGenerated} />

      {script.length > 0 && (
        <ScriptEditor title={title} script={script} onUpdate={handleScriptUpdate} />
      )}

      {script.length >= 2 && (
        <SynthesisPanel
          title={title}
          script={script}
          onComplete={handleComplete}
        />
      )}

      <AudioPlayer episode={currentEpisode} />
      <EpisodeHistory episodes={history} onSelect={handleSelectEpisode} />
    </div>
  );
}

export default App;
