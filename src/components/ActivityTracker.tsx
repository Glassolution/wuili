import { useAuth } from "@/contexts/AuthContext";
import { useActivityTracker } from "@/hooks/useActivityTracker";

// Registra sessões e navegação de todos os usuários logados (não só do dashboard).
export default function ActivityTracker() {
  const { user } = useAuth();
  useActivityTracker(user?.id ?? null);
  return null;
}
