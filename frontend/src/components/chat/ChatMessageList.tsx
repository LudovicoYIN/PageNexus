import { Bubble } from "@ant-design/x";
import type { BubbleItemType } from "@ant-design/x";
import { ChatAssistantContent } from "./ChatAssistantContent";
import { ChatMessageContent } from "./ChatMessageContent";
import type { ChatBubbleContent } from "./chat-types";

interface Props {
  items: BubbleItemType[];
}

export function ChatMessageList(props: Props) {
  const renderContent = (content: unknown) => {
    const payload = (content ?? "") as ChatBubbleContent;
    if (typeof payload === "string") {
      return <ChatMessageContent content={payload} />;
    }
    if (payload && typeof payload === "object" && "kind" in payload) {
      if (payload.kind === "assistant") return <ChatAssistantContent content={payload} />;
      if (payload.kind === "user") return <ChatMessageContent content={payload.text} />;
    }
    return <ChatMessageContent content={String(content ?? "")} />;
  };

  return (
    <Bubble.List
      autoScroll
      items={props.items}
      role={{
        ai: {
          placement: "start",
          variant: "shadow",
          shape: "corner",
          contentRender: renderContent,
        },
        user: {
          placement: "end",
          variant: "filled",
          shape: "corner",
          contentRender: renderContent,
        },
      }}
      style={{ height: "100%", overflow: "auto", padding: "12px 10px 6px" }}
    />
  );
}
