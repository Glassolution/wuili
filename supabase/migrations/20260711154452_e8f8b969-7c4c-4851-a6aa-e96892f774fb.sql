CREATE POLICY "Admins can view all refund requests"
  ON public.refund_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));