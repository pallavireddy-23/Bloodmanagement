-- Run once in the Supabase SQL editor, on a new project.
begin;
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (length(trim(display_name)) between 1 and 100),
 role text not null default 'requester' check(role in ('admin','staff','requester'))
);
create function public.app_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.profiles where user_id=auth.uid()
$$;
create function public.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.app_role() in ('admin','staff'), false)
$$;
create table public.donors (
 donor_id bigint generated always as identity primary key,
 name text not null check(length(trim(name)) between 1 and 100),
 contact text not null default '' check(length(contact)<=100),
 blood_group text not null check(blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
 created_at timestamptz not null default now()
);
create table public.donations (
 donation_id bigint generated always as identity primary key,
 donor_id bigint not null references public.donors,
 collected_at timestamptz not null
);
create table public.blood_units (
 unit_id text primary key check(length(trim(unit_id)) between 1 and 60),
 donation_id bigint not null references public.donations,
 blood_group text not null check(blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
 product text not null default 'PRBC' check(product='PRBC'),
 expires_at timestamptz not null,
 release_status text not null default 'quarantine' check(release_status in ('quarantine','released','rejected','discarded')),
 screening_note text,
 released_by uuid references public.profiles,
 released_at timestamptz
);
create table public.requests (
 request_id bigint generated always as identity primary key,
 requester_id uuid not null references public.profiles,
 patient_ref text not null check(length(trim(patient_ref)) between 1 and 80),
 blood_group text not null check(blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
 product text not null default 'PRBC' check(product='PRBC'),
 quantity integer not null check(quantity between 1 and 100),
 status text not null default 'pending' check(status in ('pending','approved','reserved','issued','cancelled')),
 compatibility_note text,
 compatibility_by uuid references public.profiles,
 created_at timestamptz not null default now()
);
create table public.allocations (
 allocation_id bigint generated always as identity primary key,
 request_id bigint not null references public.requests,
 unit_id text not null references public.blood_units,
 status text not null check(status in ('reserved','issued','cancelled')),
 reserved_at timestamptz not null default now(),
 issued_at timestamptz,
 cancelled_at timestamptz
);
create unique index one_live_allocation on public.allocations(unit_id) where status in ('reserved','issued');
create index unit_selection on public.blood_units(blood_group,product,expires_at,unit_id) where release_status='released';
create index request_status on public.requests(status);
create index donor_history on public.donations(donor_id);
create index allocation_request on public.allocations(request_id);
create table public.stock_thresholds (
 blood_group text primary key check(blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
 product text not null default 'PRBC' check(product='PRBC'),
 minimum_units integer not null default 5 check(minimum_units between 0 and 1000)
);
insert into public.stock_thresholds(blood_group) values ('A+'),('A-'),('B+'),('B-'),('AB+'),('AB-'),('O+'),('O-');
create table public.settings(id boolean primary key default true check(id), expiry_window_days integer not null default 7 check(expiry_window_days between 1 and 90));
insert into public.settings default values;
create table public.user_activity(user_id uuid primary key references public.profiles on delete cascade, last_seen_at timestamptz not null default now());
create table public.login_events(event_id bigint generated always as identity primary key, user_id uuid not null references auth.users on delete cascade, session_ref uuid unique not null, occurred_at timestamptz not null default now());
create table public.audit_events(event_id bigint generated always as identity primary key, actor_id uuid references public.profiles, action text not null, entity_ref text not null, occurred_at timestamptz not null default now());
create function public.audit(action text, entity text) returns void language sql security definer set search_path='' as $$
 insert into public.audit_events(actor_id,action,entity_ref) values(auth.uid(),action,entity)
$$;
-- Auth owns session creation. Browser clients cannot forge successful login events.
create function public.record_session() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.login_events(user_id,session_ref) values(new.user_id,new.id) on conflict(session_ref) do nothing;
 return new;
end $$;
create trigger record_successful_session after insert on auth.sessions for each row execute function public.record_session();
create function public.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(user_id,display_name,role) values(new.id,coalesce(nullif(left(new.raw_user_meta_data->>'display_name',100),''),'Demo user'),'requester');
 return new;
end $$;
create trigger create_app_profile after insert on auth.users for each row execute function public.create_profile();
-- All client writes go through narrowly scoped functions.
create function public.add_donor(p_name text,p_contact text,p_group text) returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint;
begin
 if not public.is_staff() then raise exception 'Staff access required'; end if;
 insert into public.donors(name,contact,blood_group) values(trim(p_name),trim(p_contact),p_group) returning donor_id into result;
 perform public.audit('Donor added',result::text); return result;
end $$;
create function public.add_unit(p_donor bigint,p_unit text,p_collected timestamptz,p_expires timestamptz) returns text language plpgsql security definer set search_path='' as $$
declare d bigint; g text;
begin
 if not public.is_staff() then raise exception 'Staff access required'; end if;
 if p_collected>now() or p_expires<=p_collected then raise exception 'Expiry must follow collection; collection cannot be in the future'; end if;
 select blood_group into strict g from public.donors where donor_id=p_donor;
 insert into public.donations(donor_id,collected_at) values(p_donor,p_collected) returning donation_id into d;
 insert into public.blood_units(unit_id,donation_id,blood_group,expires_at) values(trim(p_unit),d,g,p_expires);
 perform public.audit('Donation recorded in quarantine',p_unit); return p_unit;
end $$;
create function public.review_unit(p_unit text,p_decision text,p_note text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_staff() then raise exception 'Staff access required'; end if;
 if p_decision not in ('released','rejected','discarded') or length(trim(coalesce(p_note,'')))<3 then raise exception 'A screening decision and note are required'; end if;
 perform 1 from public.blood_units where unit_id=p_unit for update;
 if exists(select 1 from public.allocations where unit_id=p_unit and status in ('reserved','issued')) then raise exception 'Allocated units cannot be changed'; end if;
 update public.blood_units set release_status=p_decision,screening_note=p_note,released_by=auth.uid(),released_at=now() where unit_id=p_unit and release_status='quarantine';
 if not found then raise exception 'Unit is missing or has already been reviewed'; end if;
 perform public.audit('Screening: '||p_decision,p_unit);
end $$;
create function public.create_request(p_patient text,p_group text,p_quantity integer) returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint;
begin
 if public.app_role() is null then raise exception 'An application account is required'; end if;
 insert into public.requests(requester_id,patient_ref,blood_group,quantity) values(auth.uid(),trim(p_patient),p_group,p_quantity) returning request_id into result;
 perform public.audit('Request submitted',result::text); return result;
end $$;
create function public.approve_request(p_request bigint,p_note text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_staff() then raise exception 'Staff access required'; end if;
 if length(trim(coalesce(p_note,'')))<3 then raise exception 'Record staff compatibility approval'; end if;
 update public.requests set status='approved',compatibility_note=trim(p_note),compatibility_by=auth.uid() where request_id=p_request and status='pending';
 if not found then raise exception 'Request is missing or is not pending'; end if;
 perform public.audit('Compatibility approved',p_request::text);
end $$;
create function public.reserve_request(p_request bigint) returns text[] language plpgsql security definer set search_path='' as $$
declare r public.requests; chosen text[];
begin
 if not public.is_staff() then raise exception 'Staff access required'; end if;
 select * into strict r from public.requests where request_id=p_request for update;
 if r.status in ('reserved','issued') then return array(select unit_id from public.allocations where request_id=p_request and status in ('reserved','issued') order by allocation_id); end if;
 if r.status<>'approved' then raise exception 'Request must be approved before reservation'; end if;
 select array_agg(unit_id order by expires_at,unit_id) into chosen from (
 select u.unit_id,u.expires_at from public.blood_units u
 where u.blood_group=r.blood_group and u.product=r.product and u.release_status='released' and u.expires_at>clock_timestamp()
 and not exists(select 1 from public.allocations a where a.unit_id=u.unit_id and a.status in ('reserved','issued'))
 order by u.expires_at,u.unit_id limit r.quantity for update of u skip locked
 ) candidates;
 if coalesce(cardinality(chosen),0)<>r.quantity then raise exception 'Insufficient available stock; no units were reserved. Retry if another reservation is in progress.'; end if;
 insert into public.allocations(request_id,unit_id,status) select p_request,unnest(chosen),'reserved';
 update public.requests set status='reserved' where request_id=p_request;
 perform public.audit('Units reserved: '||array_to_string(chosen,', '),p_request::text); return chosen;
end $$;
create function public.issue_request(p_request bigint) returns void language plpgsql security definer set search_path='' as $$
declare r public.requests; n integer;
begin
 if not public.is_staff() then raise exception 'Staff access required'; end if;
 select * into strict r from public.requests where request_id=p_request for update;
 if r.status='issued' then return; end if;
 if r.status<>'reserved' or r.compatibility_by is null then raise exception 'Reserved units and staff compatibility approval are required'; end if;
 perform u.unit_id from public.blood_units u join public.allocations a using(unit_id) where a.request_id=p_request and a.status='reserved' for update of u;
 select count(*) into n from public.allocations a join public.blood_units u using(unit_id) where a.request_id=p_request and a.status='reserved' and u.release_status='released' and u.expires_at>clock_timestamp() and u.blood_group=r.blood_group and u.product=r.product;
 if n<>r.quantity then raise exception 'Issue blocked: a reserved unit is expired or unusable. Cancel and reserve a new request.'; end if;
 update public.allocations set status='issued',issued_at=now() where request_id=p_request and status='reserved';
 update public.requests set status='issued' where request_id=p_request;
 perform public.audit('Units issued',p_request::text);
end $$;
create function public.cancel_request(p_request bigint) returns void language plpgsql security definer set search_path='' as $$
declare r public.requests;
begin
 select * into strict r from public.requests where request_id=p_request for update;
 if not public.is_staff() and (r.requester_id<>auth.uid() or auth.uid() is null) then raise exception 'Access denied'; end if;
 if r.status='issued' then raise exception 'Issued units must remain in history'; end if;
 if r.status='cancelled' then return; end if;
 update public.allocations set status='cancelled',cancelled_at=now() where request_id=p_request and status='reserved';
 update public.requests set status='cancelled' where request_id=p_request;
 perform public.audit('Request cancelled',p_request::text);
end $$;
create function public.heartbeat() returns void language plpgsql security definer set search_path='' as $$
begin
 if public.app_role() is null then raise exception 'Application account required'; end if;
 insert into public.user_activity(user_id) values(auth.uid()) on conflict(user_id) do update set last_seen_at=now();
end $$;
create function public.end_activity() returns void language sql security definer set search_path='' as $$
 delete from public.user_activity where user_id=auth.uid()
$$;
create function public.update_settings(p_group text,p_minimum integer,p_window integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.app_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
 update public.stock_thresholds set minimum_units=p_minimum where blood_group=p_group;
 if not found then raise exception 'Unknown blood group'; end if;
 update public.settings set expiry_window_days=p_window;
 perform public.audit('Stock settings updated',p_group);
end $$;
create function public.set_role(p_user uuid,p_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.app_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
 if p_user=auth.uid() then raise exception 'You cannot change your own role'; end if;
 update public.profiles set role=p_role where user_id=p_user;
 if not found then raise exception 'Account not found'; end if;
 perform public.audit('Account role: '||p_role,p_user::text);
end $$;
create function public.user_statistics() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if public.app_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
 return jsonb_build_object('registered',(select count(*) from public.profiles),'today',(select count(distinct user_id) from public.login_events where occurred_at>=date_trunc('day',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'),'active',(select count(*) from public.user_activity where last_seen_at>now()-interval '5 minutes'));
end $$;
create view public.stock_summary with(security_invoker=true) as
 select t.blood_group,t.product,t.minimum_units,count(u.unit_id)::integer as available
 from public.stock_thresholds t left join public.blood_units u on u.blood_group=t.blood_group and u.product=t.product and u.release_status='released' and u.expires_at>now() and not exists(select 1 from public.allocations a where a.unit_id=u.unit_id and a.status in ('reserved','issued'))
 group by t.blood_group,t.product,t.minimum_units;
-- No anonymous access. Requesters can see only their own requests and allocations.
alter table public.profiles enable row level security;
create policy profile_read on public.profiles for select to authenticated using(user_id=auth.uid() or public.app_role()='admin');
alter table public.requests enable row level security;
create policy request_read on public.requests for select to authenticated using(requester_id=auth.uid() or public.is_staff());
alter table public.allocations enable row level security;
create policy allocation_read on public.allocations for select to authenticated using(public.is_staff() or exists(select 1 from public.requests r where r.request_id=allocations.request_id and r.requester_id=auth.uid()));
do $$ declare t text; begin
 foreach t in array array['donors','donations','blood_units','stock_thresholds','settings','audit_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy staff_read on public.%I for select to authenticated using(public.is_staff())',t);
 end loop;
 foreach t in array array['user_activity','login_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy admin_read on public.%I for select to authenticated using(public.app_role()=''admin'')',t);
 end loop;
end $$;
revoke all on all tables in schema public from anon,authenticated;
grant select on all tables in schema public to authenticated;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.app_role(),public.is_staff(),public.add_donor(text,text,text),public.add_unit(bigint,text,timestamptz,timestamptz),public.review_unit(text,text,text),public.create_request(text,text,integer),public.approve_request(bigint,text),public.reserve_request(bigint),public.issue_request(bigint),public.cancel_request(bigint),public.heartbeat(),public.end_activity(),public.update_settings(text,integer,integer),public.set_role(uuid,text),public.user_statistics() to authenticated;
commit;
