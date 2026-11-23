import { createRoot } from "react-dom/client";
import "./index.css";
import "@excalidraw/excalidraw/index.css";
import App from "./App";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Elemen #root tidak ditemukan di index.html");
}

createRoot(rootEl).render(<App />);
