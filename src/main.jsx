// Punto di ingresso dell'app: monta il componente radice <App /> nel div#root di index.html.
// Non contiene logica applicativa: è solo il "cavo" che collega React al DOM del browser
// (o alla webview di Tauri, quando l'app gira come eseguibile desktop).
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  // StrictMode: attiva controlli extra di React in sviluppo (es. doppio render per
  // individuare effetti collaterali impuri). Non ha alcun effetto in produzione.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

