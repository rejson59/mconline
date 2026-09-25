import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

const rootEl = document.getElementById("root");

/** Last-resort screen so a crash never leaves the player with a black page. */
function showFatal(message: string) {
  if (!rootEl) return;
  rootEl.innerHTML = `
    <div style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;font-family:monospace;color:#e0e0e0;background:#000">
      <div style="font-size:26px;text-shadow:2px 2px 0 #3f3f3f">Ups, coś poszło nie tak</div>
      <div style="max-width:560px;font-size:15px;line-height:1.5;opacity:.9">${message}</div>
      <button onclick="location.reload()" style="padding:10px 18px;background:linear-gradient(#8b8b8b,#6d6d6d);border:2px solid #000;color:#e0e0e0;font-family:inherit;font-size:16px;cursor:pointer">
        Odśwież stronę
      </button>
    </div>`;
}

const webglOk = (() => {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
})();

window.addEventListener("error", (e) => {
  console.error(e.error ?? e.message);
});

if (!webglOk) {
  showFatal(
    "Twoja przeglądarka nie udostępnia WebGL, więc grafika 3D nie może zostać uruchomiona. " +
      "Włącz akcelerację sprzętową (chrome://settings/system lub about:preferences#general) i odśwież stronę."
  );
} else if (rootEl) {
  try {
    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (e) {
    console.error(e);
    showFatal(String((e as Error)?.message ?? e));
  }
}
