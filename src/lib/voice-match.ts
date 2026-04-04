/**
 * Map noisy STT transcripts to fixed options (chips / select values).
 */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[₹,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(
        row[j]! + 1,
        row[j - 1]! + 1,
        prev + cost,
      );
      prev = tmp;
    }
  }
  return row[b.length]!;
}

/**
 * Returns the best-matching option, or null if nothing is close enough.
 */
export interface MatchableChoice {
  value: string;
  surfaces: string[];
}

export function matchTranscriptToChoice(
  transcript: string,
  choices: MatchableChoice[],
): string | null {
  const t = normalize(transcript);
  if (!t || choices.length === 0) return null;

  const flattened = choices.flatMap((choice) =>
    choice.surfaces.map((surface) => ({
      value: choice.value,
      normalized: normalize(surface),
    })),
  ).filter((entry) => entry.normalized);

  for (const entry of flattened) {
    if (t === entry.normalized) return entry.value;
  }

  for (const entry of flattened) {
    if (t.includes(entry.normalized) || entry.normalized.includes(t)) {
      return entry.value;
    }
  }

  let best: string | null = null;
  let bestDist = Infinity;
  let bestNormalized = "";

  for (const entry of flattened) {
    const d = levenshtein(t, entry.normalized);
    if (d < bestDist) {
      bestDist = d;
      best = entry.value;
      bestNormalized = entry.normalized;
    }
  }

  if (best === null) return null;
  const maxLen = Math.max(t.length, bestNormalized.length);
  const threshold = Math.max(2, Math.min(6, Math.floor(maxLen / 3)));
  return bestDist <= threshold ? best : null;
}

export function matchTranscriptToOption(
  transcript: string,
  options: string[],
): string | null {
  return matchTranscriptToChoice(
    transcript,
    options.map((option) => ({ value: option, surfaces: [option] })),
  );
}
