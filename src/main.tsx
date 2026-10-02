import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./routes.css";
import App from "./App.tsx";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DocsPage } from "./components/DocsPage";
import { WorkspaceRoute } from "./p0/WorkspaceRoute";
import { RouteSeo } from "./seo";
import { P1_ENABLED } from "./p1/config";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <RouteSeo />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/app" element={<WorkspaceRoute />} />
        <Route path="/app/explore" element={<WorkspaceRoute />} />
        <Route path="/app/watchlist" element={<WorkspaceRoute />} />
        <Route path="/app/opportunities/:id" element={<WorkspaceRoute />} />
        <Route path="/app/mandate" element={P1_ENABLED ? <WorkspaceRoute /> : <Navigate to="/app" replace />} />
        <Route path="/app/preflight/new" element={P1_ENABLED ? <WorkspaceRoute /> : <Navigate to="/app" replace />} />
        <Route path="/app/preflight/:id" element={P1_ENABLED ? <WorkspaceRoute /> : <Navigate to="/app" replace />} />
        <Route path="/app/history" element={P1_ENABLED ? <WorkspaceRoute /> : <Navigate to="/app" replace />} />
        <Route path="/app/watch" element={P1_ENABLED ? <WorkspaceRoute /> : <Navigate to="/app" replace />} />
        <Route path="/app/actions" element={P1_ENABLED ? <WorkspaceRoute /> : <Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
