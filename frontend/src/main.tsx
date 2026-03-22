import React from "react";
import ReactDOM from "react-dom/client";
import "@mariozechner/pi-web-ui/app.css";
import { App } from "./app/App";
import { ensurePiWebUiStorage } from "./lib/pi-storage";
import "./styles/index.css";

void ensurePiWebUiStorage().then(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
