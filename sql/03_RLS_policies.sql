-- =========================================
-- 통합 업체 관계도 RLS 정책
-- 작성일: 2026-01-08
-- =========================================

-- =========================================
-- RLS enable
-- =========================================
alter table company_nodes enable row level security;
alter table relationship_types enable row level security;
alter table company_relationships_v2 enable row level security;

-- =========================================
-- company_nodes policies
-- =========================================
drop policy if exists nodes_select on company_nodes;
create policy nodes_select
on company_nodes
for select
using (user_id = auth.uid()::text);

drop policy if exists nodes_insert on company_nodes;
create policy nodes_insert
on company_nodes
for insert
with check (user_id = auth.uid()::text);

drop policy if exists nodes_update on company_nodes;
create policy nodes_update
on company_nodes
for update
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);

drop policy if exists nodes_delete on company_nodes;
create policy nodes_delete
on company_nodes
for delete
using (user_id = auth.uid()::text);

-- =========================================
-- relationship_types policies
-- =========================================
drop policy if exists reltypes_select on relationship_types;
create policy reltypes_select
on relationship_types
for select
using (user_id = auth.uid()::text);

drop policy if exists reltypes_insert on relationship_types;
create policy reltypes_insert
on relationship_types
for insert
with check (user_id = auth.uid()::text);

drop policy if exists reltypes_update on relationship_types;
create policy reltypes_update
on relationship_types
for update
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);

drop policy if exists reltypes_delete on relationship_types;
create policy reltypes_delete
on relationship_types
for delete
using (user_id = auth.uid()::text);

-- =========================================
-- company_relationships_v2 policies
-- =========================================
drop policy if exists relv2_select on company_relationships_v2;
create policy relv2_select
on company_relationships_v2
for select
using (user_id = auth.uid()::text);

drop policy if exists relv2_insert on company_relationships_v2;
create policy relv2_insert
on company_relationships_v2
for insert
with check (user_id = auth.uid()::text);

drop policy if exists relv2_update on company_relationships_v2;
create policy relv2_update
on company_relationships_v2
for update
using (user_id = auth.uid()::text)
with check (user_id = auth.uid()::text);

drop policy if exists relv2_delete on company_relationships_v2;
create policy relv2_delete
on company_relationships_v2
for delete
using (user_id = auth.uid()::text);
