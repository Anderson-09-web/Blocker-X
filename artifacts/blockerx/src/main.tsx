import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

document.documentElement.classList.add("dark");

// Suppress benign Radix UI portal cleanup races that occur with React 18
// concurrent rendering. These DOMExceptions are cosmetic — the UI is already
// in the correct state — but without this handler they bubble up and trigger
// the React error boundary, showing a full-page crash screen.
window.addEventListener(
  "error",
  (event) => {
    const msg = event.message ?? event.error?.message ?? "";
    if (
      msg.includes("removeChild") ||
      msg.includes("insertBefore") ||
      msg.includes("El nodo que se va a eliminar") ||
      msg.includes("The node to be removed is not a child")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true, // capture phase — intercepts before React's own handler
);

const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(apiUrl);
}

createRoot(document.getElementById("root")!).render(<App />);
