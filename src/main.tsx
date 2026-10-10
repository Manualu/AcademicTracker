import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Registra el service worker (app sin conexión + avisos push). En la demo publicada puede no estar disponible.
if ("serviceWorker" in navigator && import.meta.env.PROD && import.meta.env.VITE_DEMO !== "1") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => undefined);
  });
}
