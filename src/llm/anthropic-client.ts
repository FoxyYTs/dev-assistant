import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

/**
 * Cliente único del SDK de Anthropic, compartido por todo el proyecto
 * (agente, streaming, chat directo) para no instanciar uno por módulo.
 */
export const client = new Anthropic({ apiKey: config.anthropicApiKey });

export default client;
