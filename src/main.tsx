import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
// @ts-ignore - no type declarations
import "@fontsource-variable/inter";
import App from "./App.tsx";
import "./index.css";
import RootErrorBoundary from "./components/RootErrorBoundary";
import { clearChunkReloadGuard, recoverFromChunkLoadError } from "./lib/chunkRecovery";

window.addEventListener("vite:preloadError", (event) => {
  if (recoverFromChunkLoadError(event.payload)) event.preventDefault();
});

window.addEventListener("error", (event) => {
  recoverFromChunkLoadError(event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  if (recoverFromChunkLoadError(event.reason)) event.preventDefault();
});

clearChunkReloadGuard();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </ThemeProvider>
);
