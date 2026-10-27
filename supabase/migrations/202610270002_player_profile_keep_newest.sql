-- A delayed request from an old tab/session must not overwrite newer progress.
CREATE OR REPLACE FUNCTION public.blockcraft_player_keep_newest()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.updated_at < OLD.updated_at THEN RETURN NULL; END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER blockcraft_player_keep_newest
  BEFORE UPDATE ON public.blockcraft_players
  FOR EACH ROW EXECUTE FUNCTION public.blockcraft_player_keep_newest();
