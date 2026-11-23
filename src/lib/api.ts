export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: { ...options.headers },
  });
}

function compactClientText(value: unknown, maxChars: number): string {
  const normalized = String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, maxChars).trimEnd() + '…';
}

export function prepareSuggestTagsPayload(
  content: string,
  notes: Array<{ id: string; title: string }> = [],
  concepts: Array<{ id: string; name: string }> = []
) {
  return {
    content: compactClientText(content, 2400),
    notes: notes.slice(0, 20).map((n) => ({
      id: n.id,
      title: compactClientText(n.title, 70),
    })),
    concepts: concepts.slice(0, 15).map((c) => ({
      id: c.id,
      name: compactClientText(c.name, 50),
    })),
  };
}

export function prepareZettelkastenPayload(
  prompt: string,
  notes: Array<{ id: string; title: string; content: string; updatedAt?: number; createdAt?: number }> = [],
  concepts: Array<{ id: string; name: string; definition?: string }> = [],
  fragments: Array<{ quote: string; context?: string }> = [],
  relations: Array<{ sourceNodeId: string; targetNodeId: string; relationType?: string; type?: string }> = []
) {
  const cleanPrompt = compactClientText(prompt, 1200);
  const terms = cleanPrompt
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 12);

  const scoreMatch = (...fields: Array<string | undefined>) => {
    if (terms.length === 0) return 0;
    let score = 0;
    fields.forEach((f, idx) => {
      const text = (f || '').toLowerCase();
      if (!text) return;
      const weight = idx === 0 ? 3 : 1;
      for (const t of terms) {
        if (text.includes(t)) score += weight;
      }
    });
    return score;
  };

  const selectedNotes = [...notes]
    .sort((a, b) => scoreMatch(b.title, b.content) - scoreMatch(a.title, a.content) || (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .slice(0, 10)
    .map((n) => ({
      id: n.id,
      title: compactClientText(n.title, 80),
      content: compactClientText(n.content, 400),
      updatedAt: n.updatedAt || n.createdAt || 0,
    }));

  const selectedConcepts = [...concepts]
    .sort((a, b) => scoreMatch(b.name, b.definition) - scoreMatch(a.name, a.definition))
    .slice(0, 10)
    .map((c) => ({
      id: c.id,
      name: compactClientText(c.name, 60),
      definition: compactClientText(c.definition, 200),
    }));

  const selectedFragments = [...fragments]
    .sort((a, b) => scoreMatch(b.quote, b.context) - scoreMatch(a.quote, a.context))
    .slice(0, 8)
    .map((f) => ({
      quote: compactClientText(f.quote, 240),
      context: compactClientText(f.context, 120),
    }));

  const selectedIds = new Set([
    ...selectedNotes.map((n) => n.id),
    ...selectedConcepts.map((c) => c.id),
  ]);

  const selectedRelations = relations
    .filter((r) => selectedIds.has(r.sourceNodeId) || selectedIds.has(r.targetNodeId))
    .slice(0, 12)
    .map((r) => ({
      sourceNodeId: r.sourceNodeId,
      targetNodeId: r.targetNodeId,
      relationType: r.relationType || r.type || 'related',
    }));

  return {
    prompt: cleanPrompt,
    notes: selectedNotes,
    concepts: selectedConcepts,
    fragments: selectedFragments,
    relations: selectedRelations,
  };
}

export function prepareContentExcerpt(content: string, maxChars = 4800): string {
  const normalized = String(content ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (normalized.length <= maxChars) return normalized;
  const headLen = Math.floor(maxChars * 0.65);
  const tailLen = Math.max(0, maxChars - headLen - 7);
  return `${normalized.slice(0, headLen).trimEnd()}\n[...]\n${normalized.slice(normalized.length - tailLen).trimStart()}`;
}

