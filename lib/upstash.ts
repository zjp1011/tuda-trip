import { Index } from "@upstash/vector";

const UPSTASH_VECTOR_REST_URL = process.env.UPSTASH_VECTOR_REST_URL;
const UPSTASH_VECTOR_REST_TOKEN = process.env.UPSTASH_VECTOR_REST_TOKEN;

if (!UPSTASH_VECTOR_REST_URL) {
  throw new Error("Missing environment variable: UPSTASH_VECTOR_REST_URL");
}

if (!UPSTASH_VECTOR_REST_TOKEN) {
  throw new Error("Missing environment variable: UPSTASH_VECTOR_REST_TOKEN");
}

export const vectorIndex = new Index({
  url: UPSTASH_VECTOR_REST_URL,
  token: UPSTASH_VECTOR_REST_TOKEN,
});
