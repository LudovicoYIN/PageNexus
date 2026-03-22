import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentMessage, AgentEvent } from "@mariozechner/pi-agent-core";
import { createPackyModel, PACKY_API_KEY } from "./model";
import { createKnowledgeBaseTools } from "./tools";

const BASE_PROMPT = `你是 PageNexus 的知识库问答 Agent。

你必须遵守以下规则：
1. 只能基于当前知识库内的文档回答。
2. 每次回答前都应优先调用 kb_search_text，必要时再调用 kb_read_pages。
3. 如果检索不到证据，明确回答“未在当前知识库找到”。
4. 严禁编造文档内容、页码或来源。
5. 最终回答必须在正文中自然包含来源，格式固定为《文件名》p.页码。
6. 多个来源都用相同格式列出，不要输出裸页码。
7. 回答用中文，先给结论，再给简洁依据。`;

export function createKnowledgeAgent(
  getKbId: () => string | null,
  initialMessages: AgentMessage[] = [],
  onEvent?: (event: AgentEvent, agent: Agent) => void,
  api: "openai-responses" | "openai-completions" = "openai-responses",
): Agent {
  const agent = new Agent({
    initialState: {
      systemPrompt: BASE_PROMPT,
      model: createPackyModel(api),
      thinkingLevel: "low",
      messages: initialMessages,
      tools: createKnowledgeBaseTools(getKbId)
    },
    getApiKey: () => PACKY_API_KEY,
    toolExecution: "sequential"
  });

  if (onEvent) {
    agent.subscribe((event) => onEvent(event, agent));
  }

  return agent;
}
