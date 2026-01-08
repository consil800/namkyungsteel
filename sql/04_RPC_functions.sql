-- =========================================
-- 통합 업체 관계도 RPC 함수들
-- 작성일: 2026-01-08
-- =========================================

-- =========================================
-- 1) center 노드 찾기 함수 (등록/미등록)
-- =========================================
create or replace function resolve_center_node_id(
  p_center_is_registered boolean,
  p_center_company_id bigint,
  p_center_company_name text
) returns uuid
language plpgsql
as $$
declare
  v_user_id text := get_app_user_id();
  v_node_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_center_is_registered then
    select id into v_node_id
    from company_nodes
    where user_id = v_user_id
      and is_registered = true
      and company_id = p_center_company_id
    limit 1;
  else
    select id into v_node_id
    from company_nodes
    where user_id = v_user_id
      and is_registered = false
      and display_name_norm = lower(trim(coalesce(p_center_company_name,'미상')))
    limit 1;
  end if;

  if v_node_id is null then
    raise exception 'Center node not found (create node first): registered=% company_id=% name=%',
      p_center_is_registered, p_center_company_id, p_center_company_name;
  end if;

  return v_node_id;
end;
$$;

-- =========================================
-- 2) 1-hop 그래프 RPC (직접 연결된 업체만)
-- =========================================
create or replace function get_company_graph_1hop(
  p_center_is_registered boolean,
  p_center_company_id bigint default null,
  p_center_company_name text default null,
  p_include_inactive boolean default false
) returns jsonb
language plpgsql
as $$
declare
  v_user_id text := get_app_user_id();
  v_center uuid;
  v_edges jsonb;
  v_nodes jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_center := resolve_center_node_id(p_center_is_registered, p_center_company_id, p_center_company_name);

  with edges as (
    select r.*
    from company_relationships_v2 r
    where r.user_id = v_user_id
      and (p_include_inactive or r.status = 'active')
      and (r.from_node_id = v_center or r.to_node_id = v_center)
  ),
  node_ids as (
    select v_center as id
    union
    select from_node_id from edges
    union
    select to_node_id from edges
  ),
  nodes as (
    select
      n.id as node_id,
      n.is_registered,
      n.company_id,
      n.display_name,
      c.region,
      c.address,
      c.phone
    from company_nodes n
    left join client_companies c
      on c.id = n.company_id
     and c.user_id = v_user_id
    where n.user_id = v_user_id
      and n.id in (select id from node_ids)
  )
  select
    jsonb_agg(
      jsonb_build_object(
        'id', node_id,
        'isRegistered', is_registered,
        'companyId', company_id,
        'name', display_name,
        'region', region,
        'address', address,
        'phone', phone
      )
    )
  into v_nodes
  from nodes;

  select
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'from', from_node_id,
        'to', to_node_id,
        'type', relationship_type,
        'directed', directed,
        'strength', strength,
        'status', status,
        'properties', properties,
        'fromPosition', from_position,
        'toPosition', to_position,
        'createdAt', created_at,
        'updatedAt', updated_at
      )
    )
  into v_edges
  from (
    select * from company_relationships_v2
    where user_id = v_user_id
      and (p_include_inactive or status = 'active')
      and (from_node_id = v_center or to_node_id = v_center)
  ) e;

  return jsonb_build_object(
    'centerNodeId', v_center,
    'nodes', coalesce(v_nodes, '[]'::jsonb),
    'edges', coalesce(v_edges, '[]'::jsonb)
  );
end;
$$;

-- =========================================
-- 3) 2-hop 그래프 RPC (연결의 연결까지)
-- =========================================
create or replace function get_company_graph_2hop(
  p_center_is_registered boolean,
  p_center_company_id bigint default null,
  p_center_company_name text default null,
  p_include_inactive boolean default false,
  p_max_edges int default 2000
) returns jsonb
language plpgsql
as $$
declare
  v_user_id text := get_app_user_id();
  v_center uuid;
  v_nodes jsonb;
  v_edges jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_center := resolve_center_node_id(p_center_is_registered, p_center_company_id, p_center_company_name);

  -- 1-hop edges
  with e1 as (
    select r.*
    from company_relationships_v2 r
    where r.user_id = v_user_id
      and (p_include_inactive or r.status = 'active')
      and (r.from_node_id = v_center or r.to_node_id = v_center)
  ),
  neighbors as (
    select distinct
      case when from_node_id = v_center then to_node_id else from_node_id end as node_id
    from e1
  ),
  seed as (
    select v_center as node_id
    union
    select node_id from neighbors
  ),
  e2 as (
    -- 2-hop: seed에 속한 노드가 포함된 모든 edge
    select r.*
    from company_relationships_v2 r
    where r.user_id = v_user_id
      and (p_include_inactive or r.status = 'active')
      and (r.from_node_id in (select node_id from seed)
        or r.to_node_id in (select node_id from seed))
    limit p_max_edges
  ),
  node_ids as (
    select distinct node_id from seed
    union
    select distinct from_node_id from e2
    union
    select distinct to_node_id from e2
  ),
  nodes as (
    select
      n.id as node_id,
      n.is_registered,
      n.company_id,
      n.display_name,
      c.region,
      c.address,
      c.phone
    from company_nodes n
    left join client_companies c
      on c.id = n.company_id
     and c.user_id = v_user_id
    where n.user_id = v_user_id
      and n.id in (select node_id from node_ids)
  )
  select
    jsonb_agg(
      jsonb_build_object(
        'id', node_id,
        'isRegistered', is_registered,
        'companyId', company_id,
        'name', display_name,
        'region', region,
        'address', address,
        'phone', phone
      )
    )
  into v_nodes
  from nodes;

  select
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'from', from_node_id,
        'to', to_node_id,
        'type', relationship_type,
        'directed', directed,
        'strength', strength,
        'status', status,
        'properties', properties,
        'fromPosition', from_position,
        'toPosition', to_position,
        'createdAt', created_at,
        'updatedAt', updated_at
      )
    )
  into v_edges
  from e2;

  return jsonb_build_object(
    'centerNodeId', v_center,
    'nodes', coalesce(v_nodes, '[]'::jsonb),
    'edges', coalesce(v_edges, '[]'::jsonb)
  );
end;
$$;
