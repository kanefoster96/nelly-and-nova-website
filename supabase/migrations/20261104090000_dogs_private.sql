-- ============================================================================
-- Nelly & Nova — dog records are private (applied 4 Nov 2026)
-- ============================================================================
-- "dogs: read all (community)" let any signed-in owner read every dog's row,
-- health and vet details included. Nothing needs it: owners read their own
-- dogs ("nn: read own dogs"), trainers read all (nn_is_admin()), and the
-- community shows dog names and photos through nn_community_authors, which
-- runs with its own rights. Safe to run again.
-- ============================================================================

drop policy if exists "dogs: read all (community)" on public.dogs;
