-- Press: accounts + shared crews. Run this once in Supabase > SQL Editor.
-- Everyone in a crew sees and edits the same rounds, players and payments.

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.crew_members (
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

-- One row per round / player / payment. `data` is the app's own JSON for that item.
create table if not exists public.crew_rounds (
  id text primary key,
  crew_id uuid not null references public.crews(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create table if not exists public.crew_players (like public.crew_rounds including all);
create table if not exists public.crew_payments (like public.crew_rounds including all);
alter table public.crew_players add constraint crew_players_crew_fk foreign key (crew_id) references public.crews(id) on delete cascade;
alter table public.crew_payments add constraint crew_payments_crew_fk foreign key (crew_id) references public.crews(id) on delete cascade;

create index if not exists crew_rounds_crew_idx on public.crew_rounds(crew_id);
create index if not exists crew_players_crew_idx on public.crew_players(crew_id);
create index if not exists crew_payments_crew_idx on public.crew_payments(crew_id);

create or replace function public.touch_row() returns trigger language plpgsql as $$
begin new.updated_at = now(); new.updated_by = auth.uid(); return new; end $$;
create trigger crew_rounds_touch before insert or update on public.crew_rounds for each row execute function public.touch_row();
create trigger crew_players_touch before insert or update on public.crew_players for each row execute function public.touch_row();
create trigger crew_payments_touch before insert or update on public.crew_payments for each row execute function public.touch_row();

-- Membership check used by every policy (security definer avoids recursive RLS).
create or replace function public.is_crew_member(p_crew uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.crew_members m where m.crew_id = p_crew and m.user_id = auth.uid());
$$;

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.crew_rounds enable row level security;
alter table public.crew_players enable row level security;
alter table public.crew_payments enable row level security;

create policy crews_read on public.crews for select using (public.is_crew_member(id));
create policy crews_rename on public.crews for update using (public.is_crew_member(id)) with check (public.is_crew_member(id));
create policy members_read on public.crew_members for select using (public.is_crew_member(crew_id));

create policy rounds_all on public.crew_rounds for all using (public.is_crew_member(crew_id)) with check (public.is_crew_member(crew_id));
create policy players_all on public.crew_players for all using (public.is_crew_member(crew_id)) with check (public.is_crew_member(crew_id));
create policy payments_all on public.crew_payments for all using (public.is_crew_member(crew_id)) with check (public.is_crew_member(crew_id));

-- Creating / joining happen through these functions so people can't write membership rows directly.
create or replace function public.create_crew(p_name text, p_display text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_code text; v_crew public.crews;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.crew_members where user_id = auth.uid()) then raise exception 'You are already in a crew'; end if;
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.crews where invite_code = v_code);
  end loop;
  insert into public.crews (name, invite_code, created_by) values (trim(p_name), v_code, auth.uid()) returning * into v_crew;
  insert into public.crew_members (crew_id, user_id, display_name) values (v_crew.id, auth.uid(), trim(p_display));
  return jsonb_build_object('id', v_crew.id, 'name', v_crew.name, 'invite_code', v_crew.invite_code);
end $$;

create or replace function public.join_crew(p_code text, p_display text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_crew public.crews;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.crew_members where user_id = auth.uid()) then raise exception 'You are already in a crew'; end if;
  select * into v_crew from public.crews where invite_code = upper(trim(p_code));
  if not found then raise exception 'That invite code does not exist'; end if;
  insert into public.crew_members (crew_id, user_id, display_name) values (v_crew.id, auth.uid(), trim(p_display));
  return jsonb_build_object('id', v_crew.id, 'name', v_crew.name, 'invite_code', v_crew.invite_code);
end $$;

create or replace function public.my_crew() returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object('id', c.id, 'name', c.name, 'invite_code', c.invite_code)
  from public.crew_members m join public.crews c on c.id = m.crew_id
  where m.user_id = auth.uid() order by m.joined_at limit 1;
$$;

revoke all on function public.create_crew(text, text), public.join_crew(text, text), public.my_crew() from public, anon;
grant execute on function public.create_crew(text, text), public.join_crew(text, text), public.my_crew() to authenticated;

-- Live updates between phones.
alter publication supabase_realtime add table public.crew_rounds, public.crew_players, public.crew_payments;
