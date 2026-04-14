import { useState } from "react";
import type { ScriptTurn, ScriptGenerationResponse, EpisodeRecord, DocumentUploadResponse } from "./api";
import { DocumentUpload } from "./components/DocumentUpload";
import { ThemesReview } from "./components/ThemesReview";
import { ScriptGenerator } from "./components/ScriptGenerator";
import { ScriptEditor } from "./components/ScriptEditor";
import { SynthesisPanel } from "./components/SynthesisPanel";
import { AudioPlayer } from "./components/AudioPlayer";
import { EpisodeHistory } from "./components/EpisodeHistory";
import "./App.css";

type InputMode = "choose" | "document-themes" | "topic-only";

function App() {
  const [inputMode, setInputMode] = useState<InputMode>("choose");
  const [documentId, setDocumentId] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [themes, setThemes] = useState<string[]>([]);
  const [themesConfirmed, setThemesConfirmed] = useState(false);
  const [title, setTitle] = useState("");
  const [script, setScript] = useState<ScriptTurn[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<EpisodeRecord | null>(null);
  const [history, setHistory] = useState<EpisodeRecord[]>([]);

  const handleDocumentReady = (result: DocumentUploadResponse) => {
    setDocumentId(result.documentId);
    setCharCount(result.charCount);
    setInputMode("document-themes");
  };

  const handleThemesReady = (readyThemes: string[]) => {
    setThemes(readyThemes);
    setThemesConfirmed(true);
  };

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

  const handleReset = () => {
    setInputMode("choose");
    setDocumentId("");
    setCharCount(0);
    setThemes([]);
    setThemesConfirmed(false);
    setTitle("");
    setScript([]);
    setCurrentEpisode(null);
  };

  return (
    <div className="app">
      <header>
        <h1>🎙️ PodcastGen</h1>
        <p className="muted">
          {inputMode === "choose"
            ? "Upload a document or enter a topic to generate a podcast"
            : "Generate → Edit → Synthesize → Listen"}
        </p>
        {inputMode !== "choose" && (
          <button className="btn-small" style={{ marginTop: 4 }} onClick={handleReset}>
            ← Start over
          </button>
        )}
      </header>

      {/* Step 1: Choose input mode */}
      {inputMode === "choose" && (
        <DocumentUpload
          onDocumentReady={handleDocumentReady}
          onSkip={() => setInputMode("topic-only")}
        />
      )}

      {/* Step 2 (document mode): Themes review */}
      {inputMode === "document-themes" && !themesConfirmed && (
        <ThemesReview
          documentId={documentId}
          charCount={charCount}
          onThemesReady={handleThemesReady}
          onBack={() => {
            setInputMode("choose");
            setDocumentId("");
            setCharCount(0);
          }}
        />
      )}

      {/* Step 3 (document mode) or Step 1 (topic mode): Script generation */}
      {(inputMode === "topic-only" || (inputMode === "document-themes" && themesConfirmed)) && script.length === 0 && (
        <ScriptGenerator
          onGenerated={handleGenerated}
          documentId={inputMode === "document-themes" ? documentId : undefined}
          themes={inputMode === "document-themes" ? themes : undefined}
        />
      )}

      {script.length > 0 && (
        <ScriptEditor title={title} script={script} onUpdate={handleScriptUpdate} stepOffset={inputMode === "document-themes" ? 3 : 1} />
      )}

      {script.length >= 2 && (
        <SynthesisPanel
          title={title}
          script={script}
          onComplete={handleComplete}
          stepOffset={inputMode === "document-themes" ? 4 : 2}
        />
      )}

      <AudioPlayer episode={currentEpisode} />
      <EpisodeHistory episodes={history} onSelect={handleSelectEpisode} />
    </div>
  );
}

export default App;
