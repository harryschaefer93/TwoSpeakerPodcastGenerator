import { useState, useEffect } from "react";
import { api } from "../api";

interface Props {
  documentId: string;
  charCount: number;
  onThemesReady: (themes: string[]) => void;
  onBack: () => void;
}

export function ThemesReview({ documentId, charCount, onThemesReady, onBack }: Props) {
  const [themes, setThemes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [error, setError] = useState("");

  const handleExtract = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await api.extractThemes(documentId);
      setThemes(res.themes);
      setExtracted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Theme extraction failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!extracted && !loading) {
      handleExtract();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRemove = (index: number) => {
    setThemes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEdit = (index: number, value: string) => {
    setThemes((prev) => prev.map((t, i) => (i === index ? value : t)));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setThemes((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === themes.length - 1) return;
    setThemes((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleAdd = () => {
    setThemes((prev) => [...prev, ""]);
  };

  return (
    <section className="panel">
      <h2>2. Review Discussion Themes</h2>
      <p className="muted" style={{ marginBottom: 12 }}>
        These are the key themes extracted from your document. Reorder, edit, or remove them to shape the podcast discussion.
      </p>

      {!extracted && (
        <>
          {loading && (
            <p className="muted">Analyzing {charCount.toLocaleString()} characters…</p>
          )}
          {!loading && (
            <button onClick={handleExtract} disabled={loading}>
              Extract Key Themes
            </button>
          )}
        </>
      )}

      {extracted && themes.length > 0 && (
        <>
          <div className="theme-list">
            {themes.map((theme, i) => (
              <div key={i} className="theme-card">
                <span className="theme-number">{i + 1}</span>
                <input
                  value={theme}
                  onChange={(e) => handleEdit(i, e.target.value)}
                  className="theme-input"
                />
                <div className="theme-actions">
                  <button className="btn-icon" onClick={() => handleMoveUp(i)} disabled={i === 0} title="Move up">↑</button>
                  <button className="btn-icon" onClick={() => handleMoveDown(i)} disabled={i === themes.length - 1} title="Move down">↓</button>
                  <button className="btn-icon btn-danger" onClick={() => handleRemove(i)} title="Remove">✕</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn-small" onClick={handleAdd}>+ Add theme</button>
            <button className="btn-small" onClick={handleExtract} disabled={loading}>Re-extract</button>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button onClick={() => onThemesReady(themes.filter(Boolean))}>
              Continue with these themes →
            </button>
            <button className="btn-small" onClick={onBack}>← Back</button>
          </div>
        </>
      )}

      {extracted && themes.length === 0 && (
        <div>
          <p className="muted">No themes could be extracted (AI may be unavailable). You can add themes manually or continue without them.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn-small" onClick={handleAdd}>+ Add theme manually</button>
            <button onClick={() => onThemesReady([])}>Continue without themes →</button>
            <button className="btn-small" onClick={onBack}>← Back</button>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}
