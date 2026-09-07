-- A commitment category is the default for future occurrences. Historical
-- transactions may legitimately keep a different category after an edit.
-- The API changes the commitment first and the transaction second in one
-- database transaction, so a category correction remains atomic and the
-- trigger still protects direct inserts and new links.
create or replace function public.validate_transaction_commitment_category()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  linked_commitment record;
begin
  if new.commitment_id is null then
    return new;
  end if;

  select user_id, category_id, direction
    into linked_commitment
  from public.commitments
  where id = new.commitment_id;

  if not found or linked_commitment.user_id is distinct from new.user_id then
    raise exception 'Linked commitment does not belong to the transaction user'
      using errcode = '23514',
            detail = 'commitment_user_mismatch';
  end if;

  if linked_commitment.direction is distinct from new.direction then
    raise exception 'Transaction direction must match its commitment'
      using errcode = '23514',
            detail = 'commitment_direction_mismatch';
  end if;

  if tg_op = 'INSERT' then
    if linked_commitment.category_id is distinct from new.category_id then
      raise exception 'Transaction category must match its commitment category'
        using errcode = '23514',
              detail = 'commitment_category_mismatch';
    end if;
  elsif old.commitment_id is distinct from new.commitment_id then
    if linked_commitment.category_id is distinct from new.category_id then
      raise exception 'Transaction category must match its commitment category'
        using errcode = '23514',
              detail = 'commitment_category_mismatch';
    end if;
  elsif new.category_id is distinct from old.category_id
    and linked_commitment.category_id is distinct from new.category_id then
    raise exception 'A corrected transaction category must become the commitment default'
      using errcode = '23514',
            detail = 'commitment_category_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_validate_commitment_category on public.transactions;
create trigger transactions_validate_commitment_category
before insert or update of user_id, commitment_id, category_id, direction
on public.transactions
for each row execute function public.validate_transaction_commitment_category();

drop trigger if exists commitments_validate_transaction_category on public.commitments;
drop function if exists public.validate_commitment_transaction_categories();
