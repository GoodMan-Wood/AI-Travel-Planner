create table if not exists profiles (
    id uuid primary key default auth.uid(),
    full_name text,
    avatar_url text,
    locale text default 'zh-CN',
    created_at timestamptz default timezone('utc', now())
);

create table if not exists trips (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid references auth.users not null,
    title text not null,
    intent text not null,
    generated_itinerary text,
    total_budget numeric,
    currency char(3) default 'CNY',
    budget_breakdown jsonb,
    trip_start date,
    trip_end date,
    created_at timestamptz default timezone('utc', now()),
    updated_at timestamptz default timezone('utc', now())
);

alter table trips enable row level security;
create policy "Users can manage own trips"
    on trips for all
    using (owner_id = auth.uid());

create table if not exists expenses (
    id uuid primary key default gen_random_uuid(),
    trip_id uuid references trips on delete cascade,
    category text,
    amount numeric,
    currency char(3) default 'CNY',
    occurred_on date,
    created_at timestamptz default timezone('utc', now())
);

alter table expenses enable row level security;
create policy "Users manage expenses of their trips"
    on expenses for all
    using (trip_id in (select id from trips where owner_id = auth.uid()));
