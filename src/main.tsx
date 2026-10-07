/** Punto di ingresso dell'app: monta il componente root in StrictMode per rilevare
 *  problemi di effetti doppi e API deprecate in fase di sviluppo. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { svegliaServer } from "./services/api";
import "./index.css";

// Prima ancora del render: il backend (se era in pausa) inizia a ripartire mentre si carica la pagina
svegliaServer();

// index.html ha sempre #root: se manca la pagina è rotta, e l'errore lo dice invece di un TypeError su null
const radice = document.getElementById("root");
if (!radice) throw new Error("Manca l'elemento #root in index.html");

createRoot(radice).render(
  <StrictMode>
    <App />
  </StrictMode>
);
