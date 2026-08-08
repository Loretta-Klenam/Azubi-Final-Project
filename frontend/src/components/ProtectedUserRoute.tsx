import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useUserAuth } from "../context/UserAuthContext";

export default function ProtectedUserRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useUserAuth();

  if (isLoading) return <p>Loading...</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
