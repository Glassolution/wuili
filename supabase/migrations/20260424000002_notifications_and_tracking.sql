-- Add ML tracking sent columns to orders
alter table orders
  add column if not exists ml_tracking_sent    boolean default false,
  add column if not exists ml_tracking_sent_at timestamp with time zone;

-- Create notifications table
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null,
  type       text not null,   -- 'fulfillment_error' | 'low_balance' | 'info' | 'success'
  title      text not null,
  message    text not null,
  read       boolean default false,
  created_at timestamp with time zone default now(),
  metadata   jsonb
);

alter table notifications enable row level security;

create policy "users see own notifications"
  on notifications for all
  using (auth.uid() = user_id);

-- Index for fast unread query per user
create index if not exists idx_notifications_user_created
  on notifications (user_id, created_at desc);

create index if not exists idx_notifications_unread
  on notifications (user_id)
  where read = false;
