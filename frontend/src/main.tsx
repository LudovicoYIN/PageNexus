import React from "react";
import ReactDOM from "react-dom/client";
import { App as AntdApp, ConfigProvider } from "antd";
import "@mariozechner/pi-web-ui/app.css";
import "antd/dist/reset.css";
import { App } from "./app/App";
import { ensurePiWebUiStorage } from "./lib/pi-storage";
import "./styles/index.css";

const studioConsoleToken = {
  colorPrimary: "#145c8f",
  colorInfo: "#145c8f",
  colorSuccess: "#158f77",
  colorWarning: "#cf7f1f",
  colorError: "#bc3f57",
  colorText: "#14202f",
  colorTextSecondary: "#4d5f76",
  colorBgContainer: "rgba(247, 251, 255, 0.86)",
  colorBorderSecondary: "rgba(116, 145, 175, 0.26)",
  borderRadius: 16,
  fontFamily: "\"SF Pro Display\", \"PingFang SC\", \"Helvetica Neue\", sans-serif",
};

void ensurePiWebUiStorage().then(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <ConfigProvider
        theme={{
          token: studioConsoleToken,
          components: {
            Card: {
              borderRadiusLG: 20,
              headerFontSize: 15,
            },
            Modal: {
              borderRadiusLG: 24,
            },
            Button: {
              controlHeight: 40,
              fontWeight: 600,
            },
            Input: {
              controlHeight: 42,
            },
            Tag: {
              borderRadiusSM: 999,
            },
          },
        }}
      >
        <AntdApp>
          <App />
        </AntdApp>
      </ConfigProvider>
    </React.StrictMode>,
  );
});
