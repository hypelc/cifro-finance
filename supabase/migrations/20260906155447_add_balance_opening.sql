-- Store only the user's explicit opening reference. Monthly balances remain
-- derived from this anchor and completed transactions, so historical edits can
-- be recalculated instead of leaving stale snapshots behind.
alter table public.user_settings
  add column opening_year integer,
  add column opening_month integer,
  add column opening_balance numeric(12, 2),
  add constraint user_settings_opening_period_pair_check
    check (
      (opening_year is null and opening_month is null and opening_balance is null)
      or (
        opening_year between 2000 and 2100
        and opening_month between 1 and 12
        and opening_balance is not null
      )
    );
