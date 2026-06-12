import { Navigate } from "react-router-dom";
import { AuthForm } from "../components/auth/AuthForm";
import { useAppStore } from "../stores/useAppStore";

export function HomePage() {
  const user = useAppStore((s) => s.user);
  if (user) return <Navigate to="/lega" replace />;
  return <AuthForm />;
}
