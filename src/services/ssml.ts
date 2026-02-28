import { config } from "../config.js";
import type { ScriptTurn, VoiceConfig } from "../types.js";

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const toSentence = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed.endsWith(".") && !trimmed.endsWith("!") && !trimmed.endsWith("?")) {
    return `${trimmed}.`;
  }
  return trimmed;
};

export const defaultVoiceConfig = (): VoiceConfig => ({
  useMultitalker: config.voice.useMultitalker,
  multitalkerVoice: config.voice.multitalkerVoice,
  speakerAAlias: config.voice.speakerAAlias,
  speakerBAlias: config.voice.speakerBAlias,
  speakerAFallbackVoice: config.voice.speakerAFallbackVoice,
  speakerBFallbackVoice: config.voice.speakerBFallbackVoice
});

export const buildSsml = (
  turns: ScriptTurn[],
  voiceConfig: VoiceConfig = defaultVoiceConfig()
): string => {
  if (voiceConfig.useMultitalker) {
    const dialog = turns
      .map((turn) => {
        const speakerAlias = turn.speaker === "A" ? voiceConfig.speakerAAlias : voiceConfig.speakerBAlias;
        return `<mstts:turn speaker=\"${speakerAlias}\">${escapeXml(toSentence(turn.text))}</mstts:turn>`;
      })
      .join("");

    return [
      `<speak version=\"1.0\" xmlns=\"http://www.w3.org/2001/10/synthesis\" xmlns:mstts=\"https://www.w3.org/2001/mstts\" xml:lang=\"en-US\">`,
      `<voice name=\"${voiceConfig.multitalkerVoice}\">`,
      `<mstts:dialog>${dialog}</mstts:dialog>`,
      `</voice>`,
      `</speak>`
    ].join("");
  }

  const body = turns
    .map((turn) => {
      const voice = turn.speaker === "A" ? voiceConfig.speakerAFallbackVoice : voiceConfig.speakerBFallbackVoice;
      return `<voice name=\"${voice}\">${escapeXml(toSentence(turn.text))}<break time=\"350ms\"/></voice>`;
    })
    .join("");

  return [
    `<speak version=\"1.0\" xmlns=\"http://www.w3.org/2001/10/synthesis\" xmlns:mstts=\"https://www.w3.org/2001/mstts\" xml:lang=\"en-US\">`,
    body,
    `</speak>`
  ].join("");
};
