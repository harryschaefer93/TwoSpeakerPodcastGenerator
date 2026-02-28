import type { ScriptTurn } from "../types.js";

const estimateTurnWeight = (turn: ScriptTurn): number => turn.text.length + 40;

export const chunkTurns = (turns: ScriptTurn[], maxChunkChars = 3600): ScriptTurn[][] => {
  const chunks: ScriptTurn[][] = [];
  let current: ScriptTurn[] = [];
  let currentWeight = 0;

  for (const turn of turns) {
    const weight = estimateTurnWeight(turn);
    if (current.length > 0 && currentWeight + weight > maxChunkChars) {
      chunks.push(current);
      current = [];
      currentWeight = 0;
    }

    current.push(turn);
    currentWeight += weight;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
};
