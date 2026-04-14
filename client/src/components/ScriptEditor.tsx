import { useState } from "react";
import type { ScriptTurn } from "../api";

interface Props {
  title: string;
  script: ScriptTurn[];
  onUpdate: (title: string, script: ScriptTurn[]) => void;
  stepOffset?: number;
}

export function ScriptEditor({ title, script, onUpdate, stepOffset = 1 }: Props) {
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState("");

  const updateTurn = (index: number, field: keyof ScriptTurn, value: string) => {
    const next = script.map((turn, i) =>
      i === index ? { ...turn, [field]: value } : turn
    );
    onUpdate(title, next);
  };

  const removeTurn = (index: number) => {
    onUpdate(title, script.filter((_, i) => i !== index));
  };

  const addTurn = () => {
    const lastSpeaker = script.length > 0 ? script[script.length - 1].speaker : "B";
    const next: ScriptTurn = { speaker: lastSpeaker === "A" ? "B" : "A", text: "" };
    onUpdate(title, [...script, next]);
  };

  const moveTurn = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= script.length) return;
    const next = [...script];
    [next[index], next[target]] = [next[target], next[index]];
    onUpdate(title, next);
  };

  const switchToJson = () => {
    setJsonText(JSON.stringify({ title, script }, null, 2));
    setJsonMode(true);
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (parsed.script && Array.isArray(parsed.script)) {
        onUpdate(parsed.title ?? title, parsed.script);
        setJsonMode(false);
      }
    } catch {
      // keep editor open on parse error
    }
  };

  if (jsonMode) {
    return (
      <section className="panel">
        <h2>{stepOffset + 1}. Edit Script <button className="btn-small" onClick={() => setJsonMode(false)}>Visual</button></h2>
        <textarea
          className="json-editor"
          rows={20}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />
        <button onClick={applyJson}>Apply JSON</button>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>
        {stepOffset + 1}. Edit Script
        <button className="btn-small" onClick={switchToJson}>JSON</button>
      </h2>
      <label>
        Episode Title
        <input value={title} onChange={(e) => onUpdate(e.target.value, script)} />
      </label>
      <div className="turn-list">
        {script.map((turn, i) => (
          <div key={i} className={`turn-card speaker-${turn.speaker.toLowerCase()}`}>
            <div className="turn-header">
              <select
                value={turn.speaker}
                onChange={(e) => updateTurn(i, "speaker", e.target.value as "A" | "B")}
              >
                <option value="A">Speaker A</option>
                <option value="B">Speaker B</option>
              </select>
              <span className="turn-actions">
                <button className="btn-icon" onClick={() => moveTurn(i, -1)} disabled={i === 0} title="Move up">↑</button>
                <button className="btn-icon" onClick={() => moveTurn(i, 1)} disabled={i === script.length - 1} title="Move down">↓</button>
                <button className="btn-icon btn-danger" onClick={() => removeTurn(i)} title="Remove">×</button>
              </span>
            </div>
            <textarea
              value={turn.text}
              onChange={(e) => updateTurn(i, "text", e.target.value)}
              rows={2}
            />
          </div>
        ))}
      </div>
      <button onClick={addTurn}>+ Add Turn</button>
      <p className="muted">{script.length} turns</p>
    </section>
  );
}
