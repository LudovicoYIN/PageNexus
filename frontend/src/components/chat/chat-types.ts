import type { AssistantMessage, ToolResultMessage } from "@mariozechner/pi-ai";

export type UserBubbleContent = {
  kind: "user";
  text: string;
};

export type AssistantBubbleContent = {
  kind: "assistant";
  message: AssistantMessage;
  toolResultsById: Record<string, ToolResultMessage>;
  pendingToolCallIds: string[];
  isStreaming: boolean;
};

export type ChatBubbleContent = UserBubbleContent | AssistantBubbleContent | string;
