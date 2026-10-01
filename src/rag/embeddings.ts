import OpenAI from "openai";
import { config } from "../config.js";

const openai = new OpenAI({ apiKey: config.openaiApiKey });

/** Genera el embedding de un solo texto (ej: la pregunta del usuario). */
export async function generateEmbedding(text: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([text]);
  if (!embedding) throw new Error("OpenAI no retornó ningún embedding");
  return embedding;
}

/**
 * Genera los embeddings de varios textos en una sola llamada a la API
 * (mucho más rápido que uno por uno durante la ingestión).
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await openai.embeddings.create({
    model: config.openaiEmbeddingModel,
    input: texts,
  });
  return response.data.map((item) => item.embedding);
}
