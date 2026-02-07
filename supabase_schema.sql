
-- 1. Create the table to store day logs
create table if not exists day_logs (
  date text primary key,          -- Format: YYYY-MM-DD
  minutes jsonb not null,         -- Array of 1440 status strings
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Realtime functionality for this table
alter publication supabase_realtime add table day_logs;

-- 3. Enable Row Level Security (RLS)
alter table day_logs enable row level security;

-- 4. Create a policy to allow public read/write access
-- NOTE: Since this app does not have user authentication (login),
-- we must allow the 'anon' role to select, insert, and update.
-- Be aware this means anyone with your API Key can edit this data.

create policy "Allow public access"
on day_logs
for all
using (true)
with check (true);
