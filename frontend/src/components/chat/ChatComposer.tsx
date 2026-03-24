import { Sender } from "@ant-design/x";
import { Card } from "antd";
import { useState } from "react";

interface Props {
  loading: boolean;
  disabled?: boolean;
  onSubmit: (message: string) => Promise<void>;
  onStop: () => void;
}

export function ChatComposer(props: Props) {
  const [value, setValue] = useState("");

  return (
    <Card size="small" variant="borderless" style={{ borderRadius: 16, background: "rgba(255,255,255,0.74)" }}>
      <Sender
        value={value}
        onChange={setValue}
        loading={props.loading}
        disabled={props.disabled}
        placeholder="给知识库发条消息..."
        onCancel={props.onStop}
        onSubmit={(message) => {
          void props.onSubmit(message);
          setValue("");
        }}
        style={{ width: "100%" }}
      />
    </Card>
  );
}
