import type { Agent } from "@mariozechner/pi-agent-core";
import { Card } from "antd";
import { Welcome } from "@ant-design/x";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageList } from "./ChatMessageList";
import { useAgentSessionBridge } from "./useAgentSessionBridge";

interface Props {
  session: Agent;
}

export function ChatContainer(props: Props) {
  const { items, isStreaming, send, stop } = useAgentSessionBridge(props.session);

  return (
    <Card
      bodyStyle={{ height: "100%", display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}
      style={{ height: "100%", borderRadius: 20 }}
      variant="borderless"
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        {items.length === 0 ? (
          <Welcome
            icon={null}
            title="PageNexus Chat"
            description="从左侧选择会话与文档，在这里发起问答与任务。"
          />
        ) : (
          <ChatMessageList items={items} />
        )}
      </div>
      <ChatComposer loading={isStreaming} onSubmit={send} onStop={stop} />
    </Card>
  );
}
