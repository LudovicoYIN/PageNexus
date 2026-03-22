import "@mariozechner/mini-lit/dist/CodeBlock.js";
import "@mariozechner/mini-lit/dist/MarkdownBlock.js";
import "@mariozechner/mini-lit/dist/ModeToggle.js";
import "@mariozechner/pi-web-ui";
import React, { useEffect, useRef } from "react";
import type { Agent } from "@mariozechner/pi-agent-core";

type AgentInterfaceElement = HTMLElement & {
  session?: Agent;
  enableAttachments?: boolean;
  enableModelSelector?: boolean;
  enableThinkingSelector?: boolean;
  showThemeToggle?: boolean;
};

interface Props {
  session: Agent;
}

export function PiAgentInterface(props: Props) {
  const ref = useRef<AgentInterfaceElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.session = props.session;
    element.enableAttachments = false;
    element.enableModelSelector = false;
    element.enableThinkingSelector = false;
    element.showThemeToggle = false;
  }, [props.session]);

  return <agent-interface ref={ref} />;
}
