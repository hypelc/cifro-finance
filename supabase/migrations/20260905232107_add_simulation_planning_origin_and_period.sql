alter table public.simulations
  add column period_year integer,
  add column period_month integer,
  add constraint simulations_period_pair_check
    check (
      (period_year is null and period_month is null)
      or (period_year between 2000 and 2100 and period_month between 1 and 12)
    );

alter table public.simulation_items
  add column planning_commitment_id uuid,
  add column planning_occurrence_on date,
  add constraint simulation_items_planning_commitment_fk
    foreign key (planning_commitment_id, user_id)
    references public.commitments(id, user_id)
    on delete set null (planning_commitment_id);

create index simulation_items_planning_origin_idx
  on public.simulation_items (simulation_id, user_id, planning_commitment_id, planning_occurrence_on)
  where source = 'planning';

create unique index simulation_items_planning_origin_key
  on public.simulation_items (simulation_id, user_id, planning_commitment_id, planning_occurrence_on)
  where source = 'planning'
    and planning_commitment_id is not null
    and planning_occurrence_on is not null;
