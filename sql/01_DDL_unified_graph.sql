-- =========================================
-- 통합 업체 관계도 DDL (ChatGPT Ultra Think 설계)
-- 작성일: 2026-01-08
-- =========================================

-- =========================================
-- 0) Extensions
-- =========================================
create extension if not exists pgcrypto;

-- =========================================
-- 1) Nodes table: 등록/미등록 업체를 통합 식별하는 안정 ID(UUID) 레이어
--    - 등록업체: company_id(bigint) 매핑
--    - 미등록업체: company_id null, display_name만 보유(나중에 등록되면 company_id만 채우면 됨)
-- =========================================
create table if not exists company_nodes (
  id uuid primary key default gen_random_uuid(),

  user_id text not null, -- auth.uid()::text

  -- 등록 여부
  is_registered boolean not null default false,

  -- 등록된 업체라면 client_companies.id(bigint) 연결
  company_id bigint null,

  -- 표시명(등록/미등록 모두)
  display_name text not null,

  -- 중복 방지용 정규화 컬럼
  display_name_norm text generated always as (lower(trim(display_name))) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 등록업체: 한 유저 내 동일 company_id는 노드 1개만
create unique index if not exists ux_company_nodes_registered
on company_nodes(user_id, company_id)
where is_registered = true and company_id is not null;

-- 미등록업체: 한 유저 내 동일 이름(정규화)은 노드 1개만 (원하면 제거 가능)
create unique index if not exists ux_company_nodes_unregistered_name
on company_nodes(user_id, display_name_norm)
where is_registered = false;

create index if not exists idx_company_nodes_user
on company_nodes(user_id);

create index if not exists idx_company_nodes_company
on company_nodes(user_id, company_id)
where company_id is not null;

-- =========================================
-- 2) Relationship types: 방향/무방향 혼합을 DB에서 명시 (권장)
-- =========================================
create table if not exists relationship_types (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                 -- auth.uid()::text (개인별 타입 사전)
  code text not null,                    -- 예: 'SUPPLY', 'COOPERATION' 등
  label text not null,                   -- 표시명(한글)
  directed boolean not null default true, -- 방향성 여부
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, code)
);

create index if not exists idx_relationship_types_user
on relationship_types(user_id);

-- =========================================
-- 3) Unified edges table: company_relationships_v2 (통합 그래프의 단일 진실원천)
--    - from/to는 "company_nodes.id(uuid)"로 연결
--    - directed 혼합 + 중복 방지 인덱스 2종
-- =========================================
create table if not exists company_relationships_v2 (
  id bigserial primary key,

  user_id text not null, -- auth.uid()::text

  from_node_id uuid not null references company_nodes(id) on delete restrict,
  to_node_id   uuid not null references company_nodes(id) on delete restrict,

  -- 기존 relationship_type(text)를 유지하고 싶으면 그대로 사용(아래 directed는 타입 사전으로 결정 가능)
  relationship_type text not null,

  directed boolean not null default true, -- 방향/무방향 혼합

  strength int not null default 3,        -- 1~5
  status text not null default 'active',  -- active/inactive

  properties jsonb not null default '{}'::jsonb,

  -- 기존 UI 위치 정보 유지(다만 이것은 사실 "뷰/레이아웃" 성격이라 network_views로 분리 추천)
  from_position jsonb null,
  to_position   jsonb null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint no_self_edge check (from_node_id <> to_node_id),

  -- 무방향 중복 방지용 정규화 노드 (A-B == B-A)
  a_node_id uuid generated always as (least(from_node_id, to_node_id)) stored,
  b_node_id uuid generated always as (greatest(from_node_id, to_node_id)) stored
);

-- center 조회 성능
create index if not exists idx_rel_v2_user_from
on company_relationships_v2(user_id, from_node_id);

create index if not exists idx_rel_v2_user_to
on company_relationships_v2(user_id, to_node_id);

create index if not exists idx_rel_v2_user_type
on company_relationships_v2(user_id, relationship_type);

-- ✅ 중복 방지 인덱스 (핵심)
-- 방향 관계: (from, to, type) 유니크
create unique index if not exists ux_rel_v2_directed
on company_relationships_v2(user_id, from_node_id, to_node_id, relationship_type)
where directed = true;

-- 무방향 관계: (min(from,to), max(from,to), type) 유니크
create unique index if not exists ux_rel_v2_undirected
on company_relationships_v2(user_id, a_node_id, b_node_id, relationship_type)
where directed = false;

-- =========================================
-- 4) updated_at 자동 갱신 트리거
-- =========================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_nodes_updated_at on company_nodes;
create trigger trg_nodes_updated_at
before update on company_nodes
for each row execute function set_updated_at();

drop trigger if exists trg_reltypes_updated_at on relationship_types;
create trigger trg_reltypes_updated_at
before update on relationship_types
for each row execute function set_updated_at();

drop trigger if exists trg_rel_v2_updated_at on company_relationships_v2;
create trigger trg_rel_v2_updated_at
before update on company_relationships_v2
for each row execute function set_updated_at();

-- =========================================
-- 5) 관계 저장 시 "같은 user_id 소유 노드끼리만 연결" 강제 (데이터 오염 방지)
-- =========================================
create or replace function enforce_edge_nodes_owner()
returns trigger language plpgsql as $$
declare
  from_owner text;
  to_owner text;
begin
  select user_id into from_owner from company_nodes where id = new.from_node_id;
  select user_id into to_owner   from company_nodes where id = new.to_node_id;

  if from_owner is null or to_owner is null then
    raise exception 'Invalid node reference';
  end if;

  if new.user_id is null then
    raise exception 'user_id is required';
  end if;

  if from_owner <> new.user_id or to_owner <> new.user_id then
    raise exception 'Node owner mismatch: edge.user_id=% from_owner=% to_owner=%',
      new.user_id, from_owner, to_owner;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rel_v2_owner_check on company_relationships_v2;
create trigger trg_rel_v2_owner_check
before insert or update on company_relationships_v2
for each row execute function enforce_edge_nodes_owner();

-- =========================================
-- 6) (옵션) 기존 코드 호환용 VIEW: v2를 기존 컬럼 형태로 보여주기
--    - 앱을 단계적으로 전환할 때 유용
-- =========================================
create or replace view company_relationships_unified as
select
  r.id,
  r.user_id,

  fn.display_name as from_company_name,
  tn.display_name as to_company_name,

  fn.company_id as from_company_id,
  tn.company_id as to_company_id,

  fn.is_registered as from_is_registered,
  tn.is_registered as to_is_registered,

  r.relationship_type,
  r.directed,
  r.strength,
  r.status,
  r.properties,
  r.from_position,
  r.to_position,
  r.created_at,
  r.updated_at,

  r.from_node_id,
  r.to_node_id
from company_relationships_v2 r
join company_nodes fn on fn.id = r.from_node_id
join company_nodes tn on tn.id = r.to_node_id;
