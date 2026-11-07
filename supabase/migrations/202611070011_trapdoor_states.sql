-- Additive 4.34 compatibility before clients can write trapdoor states 503–518.
-- Preserve the deployed capability/plot checks, locks, CAS/version handling and
-- service-role-only ACLs verbatim. Never reload old RPC definitions or reset data.
do $$
declare signature text; definition text;
  old_bound constant text := 'e.id not between 0 and 511';
  new_bound constant text := 'e.id not between 0 and 518';
begin
  foreach signature in array array[
    'public.blockcraft_write_blocks(text,text,jsonb)',
    'public.blockcraft_city_write_blocks(text,text,jsonb)'
  ] loop
    definition := pg_get_functiondef(signature::regprocedure);
    if array_length(string_to_array(definition, old_bound),1) = 2 then
      execute replace(definition, old_bound, new_bound);
    elsif array_length(string_to_array(definition, new_bound),1) <> 2 then
      raise exception 'Unexpected block writer validation: %; refusing to replace function.', signature;
    end if;
  end loop;
end $$;
