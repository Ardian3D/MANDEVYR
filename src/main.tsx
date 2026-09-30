import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./routes.css";
import App from "./App.tsx";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DocsPage } from "./components/DocsPage";
import { LaunchExperience } from "./components/LaunchExperience";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/app" element={<LaunchExperience />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
