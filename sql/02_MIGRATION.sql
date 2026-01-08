-- =========================================
-- 통합 업체 관계도 마이그레이션 SQL
-- 기존 company_networks + company_relationships → v2로 이관
-- 작성일: 2026-01-08
-- =========================================

-- =========================================
-- MIGRATION STEP 1) 기존 관계에서 user_id 끌어온 임시 뷰
-- =========================================
create or replace view v_old_relationships_with_user as
select
  r.*,
  n.user_id as owner_user_id
from company_relationships r
join company_networks n on n.id = r.network_id;

-- =========================================
-- MIGRATION STEP 2) 등록 노드 생성 (from/to)
-- =========================================
insert into company_nodes (user_id, is_registered, company_id, display_name)
select distinct
  owner_user_id,
  true,
  from_company_id::bigint,
  coalesce(from_company_name, '미상')
from v_old_relationships_with_user
where from_is_registered = true and from_company_id is not null
on conflict do nothing;

insert into company_nodes (user_id, is_registered, company_id, display_name)
select distinct
  owner_user_id,
  true,
  to_company_id::bigint,
  coalesce(to_company_name, '미상')
from v_old_relationships_with_user
where to_is_registered = true and to_company_id is not null
on conflict do nothing;

-- =========================================
-- MIGRATION STEP 3) 미등록 노드 생성 (from/to)
-- =========================================
insert into company_nodes (user_id, is_registered, company_id, display_name)
select distinct
  owner_user_id,
  false,
  null,
  coalesce(from_company_name, '미상')
from v_old_relationships_with_user
where (from_is_registered = false or from_company_id is null)
on conflict do nothing;

insert into company_nodes (user_id, is_registered, company_id, display_name)
select distinct
  owner_user_id,
  false,
  null,
  coalesce(to_company_name, '미상')
from v_old_relationships_with_user
where (to_is_registered = false or to_company_id is null)
on conflict do nothing;

-- =========================================
-- MIGRATION STEP 4) directed 값 결정 로직
-- - 우선순위: relationship_types에 매핑되어 있으면 그 directed 사용
-- - 없으면: 기본 true로 둠(안전)
-- =========================================
with src as (
  select
    o.*,
    rt.directed as type_directed
  from v_old_relationships_with_user o
  left join relationship_types rt
    on rt.user_id = o.owner_user_id
   and (rt.code = o.relationship_type or rt.label = o.relationship_type)
)
insert into company_relationships_v2 (
  user_id,
  from_node_id,
  to_node_id,
  relationship_type,
  directed,
  strength,
  status,
  properties,
  from_position,
  to_position,
  created_at,
  updated_at
)
select
  s.owner_user_id as user_id,

  -- from_node_id resolve
  fn.id as from_node_id,

  -- to_node_id resolve
  tn.id as to_node_id,

  s.relationship_type,

  coalesce(s.type_directed, true) as directed,

  3 as strength,
  'active' as status,
  '{}'::jsonb as properties,

  s.from_position,
  s.to_position,
  s.created_at,
  s.updated_at
from src s
join company_nodes fn
  on fn.user_id = s.owner_user_id
 and (
      (s.from_is_registered = true and fn.is_registered = true and fn.company_id = s.from_company_id::bigint)
   or ((s.from_is_registered = false or s.from_company_id is null) and fn.is_registered = false and fn.display_name_norm = lower(trim(coalesce(s.from_company_name,'미상'))))
 )
join company_nodes tn
  on tn.user_id = s.owner_user_id
 and (
      (s.to_is_registered = true and tn.is_registered = true and tn.company_id = s.to_company_id::bigint)
   or ((s.to_is_registered = false or s.to_company_id is null) and tn.is_registered = false and tn.display_name_norm = lower(trim(coalesce(s.to_company_name,'미상'))))
 )
-- 중복은 유니크 인덱스로 자동 방지, 충돌 시 skip
on conflict do nothing;

-- =========================================
-- MIGRATION STEP 5) 검증(건수 확인)
-- =========================================
select 'old relationships' as label, count(*) from company_relationships
union all
select 'v2 relationships' as label, count(*) from company_relationships_v2;

select 'nodes' as label, count(*) from company_nodes;
