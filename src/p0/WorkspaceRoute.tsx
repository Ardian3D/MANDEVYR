import { useLocation } from "react-router-dom";
import { LaunchExperience } from "../components/LaunchExperience";

export function WorkspaceRoute() {
  const location = useLocation();
  return <LaunchExperience key={location.pathname} compact={location.pathname !== "/app"} />;
}
