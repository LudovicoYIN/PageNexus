import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { listDocuments, readPages, searchText } from "./api";
import { toCompletionMessages } from "./conversation";
import { PACKY_API_BASE_URL, PACKY_API_KEY, PACKY_MODEL_ID } from "./model";
import type { DocumentRecord } from "./types";

const ANSWER_SYSTEM_PROMPT = [
  "你是 PageNexus 的知识库问答助手。",
  "你只能依据用户知识库中已解析的文件片段回答，不得编造。",
  "回答使用中文，先给结论，再给简洁依据。",
  "必须在正文中自然给出来源，格式固定为《文件名》p.页码。",
  "如果检索证据不足，明确回答“未在当前知识库找到”。",
].join("\n");

interface CompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

function buildNoMatchAnswer(parsedDocuments: DocumentRecord[], storagePath: string) {
  const docList =
    parsedDocuments.length === 0
      ? "当前知识库还没有解析完成的文档。"
      : parsedDocuments.map((document) => `- ${document.file_name} (${document.source_path})`).join("\n");

  return [
    "未在当前知识库找到。",
    "",
    `知识库存储目录：${storagePath}`,
    docList,
  ].join("\n");
}

export async function answerKnowledgeQuestion(params: {
  kbId: string;
  question: string;
  documents: DocumentRecord[];
  history: AgentMessage[];
  storagePath: string;
}): Promise<string> {
  const parsedDocuments = params.documents.filter((document) => document.status === "parsed");
  if (parsedDocuments.length === 0) {
    return buildNoMatchAnswer(parsedDocuments, params.storagePath);
  }

  const matches = await searchText(
    params.kbId,
    params.question,
    parsedDocuments.map((document) => document.id),
    8,
  );

  if (matches.length === 0) {
    return buildNoMatchAnswer(parsedDocuments, params.storagePath);
  }

  const documentById = new Map(parsedDocuments.map((document) => [document.id, document]));
  const uniqueMatches = new Map<string, (typeof matches)[number]>();

  for (const match of matches) {
    const key = `${match.doc_id}:${match.page_number}`;
    if (!uniqueMatches.has(key)) {
      uniqueMatches.set(key, match);
    }
    if (uniqueMatches.size >= 4) break;
  }

  const selectedMatches = [...uniqueMatches.values()];
  const pageContexts = await Promise.all(
    selectedMatches.map(async (match) => {
      const result = await readPages(match.doc_id, match.page_number, match.page_number);
      const text = result.pages.map((page) => page.text).join("\n");
      return {
        match,
        text,
      };
    }),
  );

  const knowledgeContext = [
    `知识库存储目录：${params.storagePath}`,
    "以下是当前问题命中的已解析文件片段。你不能脱离这些材料回答。",
    ...pageContexts.flatMap(({ match, text }) => {
      const document = documentById.get(match.doc_id);
      return [
        `文件：${match.doc_name}`,
        `PDF 原件路径：${document?.source_path ?? "unknown"}`,
        `引用：《${match.doc_name}》p.${match.page_number}`,
        `命中片段：${match.snippet}`,
        "页正文：",
        text,
        "",
      ];
    }),
  ].join("\n");

  const response = await fetch(`${PACKY_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PACKY_API_KEY}`,
    },
    body: JSON.stringify({
      model: PACKY_MODEL_ID,
      stream: false,
      messages: [
        {
          role: "system",
          content: ANSWER_SYSTEM_PROMPT,
        },
        ...toCompletionMessages(params.history).slice(-6),
        {
          role: "user",
          content: `问题：${params.question}\n\n${knowledgeContext}`,
        },
      ],
    }),
  });

  const payload = (await response.json()) as CompletionResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `PackyAPI 请求失败：${response.status}`);
  }

  const answer = payload.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    throw new Error("模型没有返回可显示的回答。");
  }

  return answer;
}
