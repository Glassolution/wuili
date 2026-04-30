import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";

interface AdminUser {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  whatsapp: string | null;
  plano: string | null;
  nicho: string | null;
  created_at: string;
  subscription: {
    plan: string;
    status: string;
    amount: number;
    current_period_end: string | null;
  } | null;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

const AdminUsersPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      // Checa se o usuário é admin antes de chamar a função
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleRow) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setIsAdmin(true);

      const { data, error: fnErr } = await supabase.functions.invoke("get-all-users");
      if (fnErr) {
        setError(fnErr.message ?? "Falha ao carregar usuários");
        setLoading(false);
        return;
      }
      setUsers((data?.users as AdminUser[]) ?? []);
      setLoading(false);
    };

    load();
  }, [user, authLoading]);

  if (authLoading || isAdmin === null) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin === false) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-2">
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">
          Esta página é exclusiva para administradores.
        </p>
      </div>
    );
  }

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      u.display_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.whatsapp?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            {users.length} usuário(s) cadastrado(s) na plataforma.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail ou WhatsApp"
            className="pl-9"
          />
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Assinatura</TableHead>
              <TableHead>Cadastro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.display_name ?? "—"}</TableCell>
                  <TableCell>{u.email ?? "—"}</TableCell>
                  <TableCell>{u.whatsapp ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.plano && u.plano !== "gratis" ? "default" : "secondary"}>
                      {u.plano ?? "gratis"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.subscription ? (
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {u.subscription.status} · {formatBRL(u.subscription.amount)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          até {formatDate(u.subscription.current_period_end)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Sem assinatura</span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(u.created_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminUsersPage;
