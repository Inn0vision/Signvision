/**
 * SiGML Sequence Compiler and Cache Service
 *
 * Compiles individual sign SiGML definitions into a single, continuous
 * multi-sign <sigml> animation document supported natively by CWASA.
 * Prevents intermittent avatar resets between consecutive words.
 */

import type { SignQueueItem } from '../types';

// In-memory cache for fetched SiGML XML text to eliminate redundant network roundtrips
const sigmlCache = new Map<string, string>();

/**
 * Clear the in-memory SiGML cache
 */
export function clearSiGMLCache(): void {
  sigmlCache.clear();
}

/**
 * Fetch a single SiGML file with in-memory caching and timeout guard
 */
export async function fetchSignXml(url: string, timeoutMs = 8000): Promise<string> {
  const cached = sigmlCache.get(url);
  if (cached) {
    return cached;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} loading SiGML from ${url}`);
    }
    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new Error(`Empty SiGML received from ${url}`);
    }
    sigmlCache.set(url, text);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract sign block tags (<hns_sign> or <hamgestural_sign>) from a SiGML XML document.
 * Ensures each sign block carries an explicit gloss attribute for CWASA event tracking.
 */
export function extractSignBlocks(xml: string, glossOverride?: string): string[] {
  if (!xml || typeof xml !== 'string') return [];

  // Match either <hns_sign>...</hns_sign> or <hamgestural_sign>...</hamgestural_sign>
  const pattern = /<(hns_sign|hamgestural_sign)[\s\S]*?<\/\1>/gi;
  const matches = xml.match(pattern);

  if (!matches || matches.length === 0) {
    // Fallback: extract inner content of <sigml>...</sigml> if present
    const innerMatch = xml.match(/<sigml[^>]*>([\s\S]*?)<\/sigml>/i);
    const inner = innerMatch ? innerMatch[1].trim() : xml.replace(/<\/?sigml[^>]*>/gi, '').trim();
    return inner ? [inner] : [];
  }

  return matches.map((block, idx) => {
    if (glossOverride) {
      const glossVal = matches.length === 1 ? glossOverride : `${glossOverride}_${idx + 1}`;
      if (/gloss=[\"'][^\"']*[\"']/i.test(block)) {
        return block.replace(/gloss=[\"'][^\"']*[\"']/i, `gloss="${glossVal}"`);
      } else {
        return block.replace(/<(hns_sign|hamgestural_sign)/i, `<$1 gloss="${glossVal}"`);
      }
    }
    return block;
  });
}

/**
 * Combine multiple SiGML XML texts and gloss words into a single continuous <sigml> document
 */
export function combineSiGMLTexts(items: { xml: string; word: string }[]): string | null {
  const allBlocks: string[] = [];

  for (const item of items) {
    const blocks = extractSignBlocks(item.xml, item.word);
    allBlocks.push(...blocks);
  }

  if (allBlocks.length === 0) {
    return null;
  }

  return `<?xml version="1.0" encoding="utf-8"?>\n<sigml>\n${allBlocks.join('\n')}\n</sigml>`;
}

export interface CompileResult {
  combinedSigml: string;
  validSigns: SignQueueItem[];
}

/**
 * Concurrently loads and compiles all signs in a sentence queue into a single continuous SiGML sequence.
 * Filters out missing or corrupted assets without crashing playback.
 */
export async function compileSentenceSiGML(signs: SignQueueItem[]): Promise<CompileResult | null> {
  if (!signs || signs.length === 0) return null;

  // Concurrently fetch all sign assets
  const fetchPromises = signs.map(async (sign) => {
    try {
      const xml = await fetchSignXml(sign.url);
      return { sign, xml, error: null };
    } catch (err) {
      console.warn(`[sigmlCompiler] Failed to fetch sign "${sign.word}" from ${sign.url}:`, err);
      return { sign, xml: null, error: err };
    }
  });

  const results = await Promise.all(fetchPromises);
  const validItems: { xml: string; word: string }[] = [];
  const validSigns: SignQueueItem[] = [];

  for (const res of results) {
    if (res.xml) {
      validItems.push({ xml: res.xml, word: res.sign.word });
      validSigns.push(res.sign);
    }
  }

  if (validSigns.length === 0) {
    return null;
  }

  const combinedSigml = combineSiGMLTexts(validItems);
  if (!combinedSigml) {
    return null;
  }

  return {
    combinedSigml,
    validSigns,
  };
}
