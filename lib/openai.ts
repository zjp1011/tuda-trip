const DEFAULT_VECTOR_DIMENSION = 1536;

function getVectorDimension() {
  const dimension = Number(process.env.VECTOR_DIMENSION ?? DEFAULT_VECTOR_DIMENSION);

  if (!Number.isInteger(dimension) || dimension <= 0) {
    throw new Error("VECTOR_DIMENSION must be a positive integer.");
  }

  return dimension;
}

function hashText(text: string) {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function tokenize(text: string) {
  const normalizedText = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]+/gu, " ");

  const words = normalizedText.split(/\s+/).filter(Boolean);
  const compactText = normalizedText.replace(/\s+/g, "");
  const charGrams: string[] = [];

  for (let index = 0; index < compactText.length - 1; index += 1) {
    charGrams.push(compactText.slice(index, index + 2));
  }

  return [...words, ...charGrams];
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.trim();

  if (!input) {
    throw new Error("generateEmbedding requires a non-empty text input.");
  }

  const dimension = getVectorDimension();
  const vector = new Array<number>(dimension).fill(0);
  const tokens = tokenize(input);

  for (const token of tokens) {
    const hash = hashText(token);
    const index = hash % dimension;
    const sign = hash & 1 ? 1 : -1;

    vector[index] += sign;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (magnitude === 0) {
    throw new Error("Failed to generate local embedding vector.");
  }

  return vector.map((value) => value / magnitude);
}
