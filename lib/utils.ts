import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Universally apply a discovered repair map to text.
 * Handles multi-character noise patterns and character mappings.
 */
export function applyRepairMap(text: string, map?: Record<string, string>): string {
  if (!text || !map || Object.keys(map).length === 0) return text;
  
  let clean = text.normalize('NFKC');
  
  // Sort keys by length descending to ensure we match longer patterns first 
  // (e.g. 'the' should be matched before 'th')
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  
  for (const junk of keys) {
    if (junk && junk.length > 0) {
      const real = map[junk];
      // Use split/join for global replacement without regex escaping issues
      clean = clean.split(junk).join(real);
    }
  }
  
  return clean.trim();
}