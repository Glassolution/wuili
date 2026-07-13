GRANT SELECT, INSERT, UPDATE ON TABLE public.support_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.support_tickets TO authenticated;
GRANT ALL ON TABLE public.support_messages TO service_role;
GRANT ALL ON TABLE public.support_tickets TO service_role;