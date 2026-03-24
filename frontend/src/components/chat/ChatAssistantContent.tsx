import type { ToolCall, ToolResultMessage } from "@mariozechner/pi-ai";
import { OpenAIOutlined, SyncOutlined } from "@ant-design/icons";
import { Collapse, Tag, Typography } from "antd";
import { Think } from "@ant-design/x";
import type { ReactNode } from "react";
import { useMemo } from "react";
import type { AssistantBubbleContent } from "./chat-types";
import { ChatMessageContent } from "./ChatMessageContent";

interface Props {
  content: AssistantBubbleContent;
}

function collectText(message: AssistantBubbleContent["message"]) {
  return message.content
    .filter((chunk): chunk is { type: "text"; text: string } => chunk.type === "text")
    .map((chunk) => chunk.text)
    .join("\n\n")
    .trim();
}

function collectThinking(message: AssistantBubbleContent["message"]) {
  return message.content
    .filter((chunk): chunk is { type: "thinking"; thinking: string } => chunk.type === "thinking")
    .map((chunk) => chunk.thinking)
    .join("\n\n")
    .trim();
}

function collectToolCalls(message: AssistantBubbleContent["message"]) {
  return message.content.filter((chunk): chunk is ToolCall => chunk.type === "toolCall");
}

function resultText(result?: ToolResultMessage) {
  if (!result) return "";
  return result.content
    .filter((chunk): chunk is { type: "text"; text: string } => chunk.type === "text")
    .map((chunk) => chunk.text)
    .join("\n\n")
    .trim();
}

function json(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function summarizeToolCall(call: ToolCall) {
  const raw = json(call.arguments);
  const oneLine = raw.replace(/\s+/g, " ").trim();
  return `${call.name} ${oneLine.length > 80 ? `${oneLine.slice(0, 80)}...` : oneLine}`;
}

export function ChatAssistantContent(props: Props) {
  const isStreaming = props.content.isStreaming;
  const answer = collectText(props.content.message);
  const thinking = collectThinking(props.content.message);
  const toolCalls = collectToolCalls(props.content.message);
  const isError = props.content.message.stopReason === "error";
  const rawHtmlError = useMemo(() => {
    const text = props.content.message.errorMessage ?? "";
    return text.includes("<!DOCTYPE html>") ? text : "";
  }, [props.content.message.errorMessage]);

  const toolRows = toolCalls.map((call) => {
    const result = props.content.toolResultsById[call.id];
    const pending = props.content.pendingToolCallIds.includes(call.id) && !result;
    const status = pending ? "running" : result?.isError ? "failed" : result ? "done" : "pending";
    const summary = summarizeToolCall(call);
    const resultContent = resultText(result);

    return (
      <div key={call.id} className="chat-action-row">
        <div className="chat-action-head">
          <code className="chat-action-command">{summary}</code>
          <Tag
            bordered={false}
            color={status === "running" ? "processing" : status === "failed" ? "error" : status === "done" ? "success" : "default"}
          >
            {status}
          </Tag>
        </div>
        {pending ? <div className="chat-action-running">Executing...</div> : null}
        {result ? (
          <Collapse
            size="small"
            ghost
            className="chat-action-collapse"
            items={[
              {
                key: "result",
                label: "Result",
                children: (
                  <div className="chat-action-result">
                    {resultContent ? <ChatMessageContent content={resultContent} /> : <Typography.Text type="secondary">No text result.</Typography.Text>}
                    <pre className="chat-section-pre">{json(result.details ?? {})}</pre>
                  </div>
                ),
              },
            ]}
          />
        ) : null}
      </div>
    );
  });

  const extraItems = [] as { key: string; label: string; children: ReactNode }[];

  if (thinking) {
    extraItems.push({
      key: "reasoning",
      label: "Reasoning Trace",
      children: (
        <Think
          title={isStreaming ? "Deep thinking" : "Complete thinking"}
          icon={<OpenAIOutlined />}
          loading={isStreaming ? <SyncOutlined className="chat-spin" /> : false}
          defaultExpanded={!isStreaming}
          blink={isStreaming}
        >
          <pre className="chat-section-pre">{thinking}</pre>
        </Think>
      ),
    });
  }

  if (isError && props.content.message.errorMessage) {
    extraItems.push({
      key: "error",
      label: "Error",
      children: <pre className="chat-section-pre chat-error-pre">{props.content.message.errorMessage}</pre>,
    });
  }
  if (rawHtmlError) {
    extraItems.push({
      key: "raw-error-html",
      label: "Raw Error HTML",
      children: <pre className="chat-section-pre chat-raw-html">{rawHtmlError}</pre>,
    });
  }

  return (
    <div className="chat-assistant-content">
      {answer ? <ChatMessageContent content={answer} /> : <Typography.Text type="secondary">No answer text. See details below.</Typography.Text>}

      {toolRows.length > 0 ? (
        <Collapse
          size="small"
          className="chat-section-collapse"
          items={[
            {
              key: "actions",
              label: (
                <div className="chat-panel-label">Actions ({toolRows.length})</div>
              ),
              children: <div className="chat-action-list">{toolRows}</div>,
            },
          ]}
        />
      ) : null}

      {extraItems.length > 0 ? <Collapse size="small" className="chat-section-collapse" items={extraItems} /> : null}
    </div>
  );
}
