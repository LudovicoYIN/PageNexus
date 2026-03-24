import { Button } from "antd";
import { XMarkdown } from "@ant-design/x-markdown";
import { useMemo, useState } from "react";

interface Props {
  content: string;
}

const COLLAPSE_THRESHOLD = 1800;

export function ChatMessageContent(props: Props) {
  const [expanded, setExpanded] = useState(false);
  const content = useMemo(() => props.content.replace(/\r\n/g, "\n").trim(), [props.content]);

  const canCollapse = content.length > COLLAPSE_THRESHOLD;
  const containerStyle = useMemo(
    () => ({
      maxHeight: canCollapse && !expanded ? 320 : undefined,
      overflow: canCollapse && !expanded ? "hidden" : "visible",
      position: "relative" as const,
    }),
    [canCollapse, expanded],
  );

  return (
    <div>
      <div style={containerStyle} className="chat-markdown">
        {content ? (
          <XMarkdown
            content={content}
            className="chat-x-markdown x-markdown-light"
            escapeRawHtml
            openLinksInNewTab
          />
        ) : (
          <div className="chat-muted">No text content.</div>
        )}
        {canCollapse && !expanded ? <div className="chat-fade-mask" /> : null}
      </div>
      {canCollapse ? (
        <div className="mt-2">
          <Button size="small" type="text" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Collapse" : "Expand"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
