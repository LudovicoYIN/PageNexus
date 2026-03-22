import type { AgentMessage } from "@mariozechner/pi-agent-core";

function textBlocksToString(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .filter((block): block is { type: string; text?: string } => typeof block === "object" && block !== null)
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("");
}

export function messageText(message: AgentMessage): string {
  if (message.role === "user" || message.role === "assistant") {
    const content = textBlocksToString(message.content);
    if (message.role === "assistant") {
      return content || message.errorMessage || "";
    }
    return content;
  }

  return "";
}

export function createUserMessage(text: string): AgentMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  };
}

export function createAssistantMessage(text: string, errorMessage?: string): AgentMessage {
  return {
    role: "assistant",
    content: text ? [{ type: "text", text }] : [],
    api: "openai-completions",
    provider: "packyapi",
    model: "gpt-5.4-low",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
    },
    stopReason: errorMessage ? "error" : "stop",
    errorMessage,
    timestamp: Date.now(),
  };
}

export function toCompletionMessages(messages: AgentMessage[]) {
  return messages
    .filter((message): message is Extract<AgentMessage, { role: "user" | "assistant" }> => {
      return message.role === "user" || message.role === "assistant";
    })
    .map((message) => ({
      role: message.role,
      content: messageText(message),
    }))
    .filter((message) => message.content.trim().length > 0);
}
