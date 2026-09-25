-- Internal helpers/trigger functions: not meant to be called through the API.
revoke execute on function public.audit_label(text, jsonb) from public, anon, authenticated;
revoke execute on function public.audit_row_change() from public, anon, authenticated;
revoke execute on function public.payments_refresh_invoice() from public, anon, authenticated;
