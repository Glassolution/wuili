import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
// @ts-ignore - no type declarations
import "@fontsource-variable/inter";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <App />
  </ThemeProvider>
);
