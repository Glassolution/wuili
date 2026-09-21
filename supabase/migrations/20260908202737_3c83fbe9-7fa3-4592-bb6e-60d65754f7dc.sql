CREATE TABLE public.dropship_worker_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('start','stop')),
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dropship_worker_commands TO authenticated;
GRANT ALL ON public.dropship_worker_commands TO service_role;

ALTER TABLE public.dropship_worker_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage worker commands"
ON public.dropship_worker_commands
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_dropship_worker_commands_updated_at
BEFORE UPDATE ON public.dropship_worker_commands
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_dropship_worker_commands_status ON public.dropship_worker_commands (status, created_at DESC);