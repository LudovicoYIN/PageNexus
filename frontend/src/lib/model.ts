import type { Api, Model } from "@mariozechner/pi-ai";

export const PACKY_API_BASE_URL = "https://www.packyapi.com/v1";
export const PACKY_API_KEY = "";
export const PACKY_MODEL_ID = "gpt-5.4-low";

type PackyApi = "openai-responses" | "openai-completions";

export function createPackyModel(api: PackyApi = "openai-responses"): Model<Api> {
  return {
    id: PACKY_MODEL_ID,
    name: "PackyAPI GPT-5.4 Low",
    api,
    provider: "packyapi",
    baseUrl: PACKY_API_BASE_URL,
    reasoning: true,
    input: ["text"],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0
    },
    contextWindow: 128000,
    maxTokens: 8192,
    ...(api === "openai-completions"
      ? {
          compat: {
            supportsDeveloperRole: false
          }
        }
      : {})
  };
}
