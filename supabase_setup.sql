
-- Run this in your Supabase SQL Editor to enable the toggle API

create or replace function toggle_default_mode()
returns text
language plpgsql
security definer
as $$
declare
  current_val text;
  new_val text;
begin
  -- Get current value, default to 'productive' if missing
  select value into current_val from app_settings where key = 'default_mode';
  
  -- Flip the value
  if current_val = 'unproductive' then
    new_val := 'productive';
  else
    new_val := 'unproductive';
  end if;
  
  -- Upsert the new value
  insert into app_settings (key, value)
  values ('default_mode', new_val)
  on conflict (key) do update set value = excluded.value;
  
  return new_val;
end;
$$;
