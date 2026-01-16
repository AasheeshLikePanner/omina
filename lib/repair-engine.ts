export interface RepairMapping {
  [junk: string]: string;
}

export function calculateCorruptionDensity(text: string): number {
  if (!text) return 0;
  // Regex includes Latin Extended-A (\u0100-\u017F) to catch characters like ƒ (U+0192)
  const suspiciousChars = /[^\x20-\x7E\u0100-\u017F\u0900-\u097F\u0C00-\u0C7F\u1E00-\u1EFF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0600-\u06FF]/g;
  const matches = text.match(suspiciousChars) || [];
  return matches.length / (text.length || 1);
}

export async function getSmartSamples(pages: { text: string; pageIndex: number }[]) {
  if (pages.length === 0) return [];

  const scores = pages.map(p => ({
    ...p,
    score: calculateCorruptionDensity(p.text)
  }));

  scores.sort((a, b) => b.score - a.score);

  // Take top 2 most corrupted + middle page for diversity
  const samples = [scores[0]?.text, scores[1]?.text, pages[Math.floor(pages.length / 2)]?.text];
  return Array.from(new Set(samples.filter(Boolean))).map(t => t!.slice(0, 800));
}

export function buildStatisticalRepairMap(samples: string[]): { map: RepairMapping, unmapped: string[] } {
  const corruptChars = new Set<string>();
  const suspiciousRegex = /[^\x20-\x7E\u0900-\u097F\u0C00-\u0C7F\u1E00-\u1EFF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0600-\u06FF]/g;

  for (const sample of samples) {
    const matches = sample.match(suspiciousRegex) || [];
    matches.forEach(char => corruptChars.add(char));
  }

  const commonDiacritics: Record<string, string> = {
    '\u201A': '\u1E5B', // ‚ -> ṛ
    '\u0192': '\u0101', // ƒ -> ā
    '\u2020': '\u1E47', // † -> ṇ
    '\u2030': '\u1E63', // ‰ -> ṣ
    '\u0152': '\u012B', // Œ -> ī
    '\u2018': '\u1E6D', // ‘ -> ṭ
    '\u2019': "'",      // ’ -> '
    '\u0160': '\u00F1', // Š -> ñ
    '\u2021': '\u0101', // ‡ -> ā
    '\u02C6': '\u016B', // ˆ -> ū
    '\u2026': '\u1E41', // … -> ṁ
    '\u0110': '"',      // Đ -> "
    '\u201C': '"',      // “ -> "
    '\u201D': '"',      // ” -> "
    '\u00D0': '"',      // Ð -> "
    '\u00C4': 'A',      // Ä -> A (German/General)
    '\u00E4': 'a',      // ä -> a
    '\u00D6': 'O',      // Ö -> O
    '\u00F6': 'o',      // ö -> o
    '\u00DC': 'U',      // Ü -> U
    '\u00FC': 'u',      // ü -> u
    '\u00DF': 'ss'      // ß -> ss
  };

  const repairMap: RepairMapping = {};
  const unmapped = new Set<string>();

  for (const char of corruptChars) {
    if (commonDiacritics[char]) {
      repairMap[char] = commonDiacritics[char];
    } else {
      unmapped.add(char);
    }
  }

  return { map: repairMap, unmapped: Array.from(unmapped) };
}