
  import { StrictMode } from "react";
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import ErrorBoundary from "./components/ErrorBoundary.tsx";
  import "./index.css";

  // A-06: StrictMode detecta efectos secundarios inesperados en desarrollo
  // Q-07: ErrorBoundary al nivel raíz — captura errores antes de que App monte
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
