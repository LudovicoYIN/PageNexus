import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ChatMessageViewModel } from "./types";
import { parseCitations } from "./citations";
import { messageText } from "./conversation";

export function mapAgentMessagesToView(messages: AgentMessage[]): ChatMessageViewModel[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .filter((message) => {
      if (message.role === "user") return true;
      return messageText(message).trim().length > 0;
    })
    .map((message, index) => {
      const content = messageText(message);
      return {
        id: `${message.role}-${message.timestamp ?? index}-${index}`,
        role: message.role,
        content,
        citations: message.role === "assistant" ? parseCitations(content) : []
      };
    });
}
