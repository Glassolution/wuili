-- ─────────────────────────────────────────────────────────────
-- TABELAS
-- ─────────────────────────────────────────────────────────────

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz default now()
);

create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null,
  fornecedor text not null,
  pais_fornecedor text not null,
  custo numeric(10,2) not null default 0,
  created_at timestamptz default now()
);

create table if not exists pedidos (
  id text primary key,                        -- ex: PED-1001
  data date not null,
  cliente_id uuid references clientes(id) on delete set null,
  loja text not null,
  status text not null,
  pagamento text not null,
  prazo_entrega text,
  rastreio text,
  avaliacao int check (avaliacao between 1 and 5),
  created_at timestamptz default now()
);

create table if not exists itens_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id text references pedidos(id) on delete cascade,
  produto_id uuid references produtos(id) on delete cascade,
  quantidade int not null default 1,
  preco_venda numeric(10,2) not null,
  frete numeric(10,2) not null default 0,
  created_at timestamptz default now()
);

create table if not exists transacoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id text references pedidos(id) on delete cascade,
  tipo text not null check (tipo in ('receita','custo','frete')),
  valor numeric(10,2) not null,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- TRIGGER: ao inserir/atualizar/deletar item_pedido,
--          recria as transações automaticamente
-- ─────────────────────────────────────────────────────────────

create or replace function sync_transacoes()
returns trigger language plpgsql as $$
declare
  v_custo numeric;
begin
  -- remove transações antigas do pedido afetado
  delete from transacoes where pedido_id = coalesce(new.pedido_id, old.pedido_id);

  -- recria para todos os itens do pedido
  insert into transacoes (pedido_id, tipo, valor)
  select
    ip.pedido_id,
    'receita',
    ip.preco_venda * ip.quantidade
  from itens_pedido ip
  where ip.pedido_id = coalesce(new.pedido_id, old.pedido_id);

  insert into transacoes (pedido_id, tipo, valor)
  select
    ip.pedido_id,
    'custo',
    p.custo * ip.quantidade
  from itens_pedido ip
  join produtos p on p.id = ip.produto_id
  where ip.pedido_id = coalesce(new.pedido_id, old.pedido_id);

  insert into transacoes (pedido_id, tipo, valor)
  select
    ip.pedido_id,
    'frete',
    ip.frete
  from itens_pedido ip
  where ip.pedido_id = coalesce(new.pedido_id, old.pedido_id)
    and ip.frete > 0;

  return new;
end;
$$;

drop trigger if exists trg_sync_transacoes on itens_pedido;
create trigger trg_sync_transacoes
after insert or update or delete on itens_pedido
for each row execute function sync_transacoes();

-- ─────────────────────────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────────────────────────

create or replace view v_lucro_total as
select
  coalesce(sum(case when tipo = 'receita' then valor else 0 end), 0) as receita,
  coalesce(sum(case when tipo = 'custo'   then valor else 0 end), 0) as custo,
  coalesce(sum(case when tipo = 'frete'   then valor else 0 end), 0) as frete,
  coalesce(
    sum(case when tipo = 'receita' then valor else 0 end) -
    sum(case when tipo = 'custo'   then valor else 0 end) -
    sum(case when tipo = 'frete'   then valor else 0 end),
  0) as lucro
from transacoes;

create or replace view v_resumo_loja as
select
  p.loja,
  count(distinct p.id) as pedidos,
  coalesce(sum(case when t.tipo = 'receita' then t.valor else 0 end), 0) as receita,
  coalesce(
    sum(case when t.tipo = 'receita' then t.valor else 0 end) -
    sum(case when t.tipo = 'custo'   then t.valor else 0 end) -
    sum(case when t.tipo = 'frete'   then t.valor else 0 end),
  0) as lucro
from pedidos p
left join transacoes t on t.pedido_id = p.id
group by p.loja
order by receita desc;

create or replace view v_resumo_status as
select
  p.status,
  count(distinct p.id) as pedidos,
  coalesce(sum(case when t.tipo = 'receita' then t.valor else 0 end), 0) as receita,
  coalesce(
    sum(case when t.tipo = 'receita' then t.valor else 0 end) -
    sum(case when t.tipo = 'custo'   then t.valor else 0 end) -
    sum(case when t.tipo = 'frete'   then t.valor else 0 end),
  0) as lucro
from pedidos p
left join transacoes t on t.pedido_id = p.id
group by p.status
order by pedidos desc;

create or replace view v_resumo_categoria as
select
  pr.categoria,
  count(distinct p.id) as pedidos,
  coalesce(sum(case when t.tipo = 'receita' then t.valor else 0 end), 0) as receita,
  coalesce(
    sum(case when t.tipo = 'receita' then t.valor else 0 end) -
    sum(case when t.tipo = 'custo'   then t.valor else 0 end) -
    sum(case when t.tipo = 'frete'   then t.valor else 0 end),
  0) as lucro,
  case
    when sum(case when t.tipo = 'receita' then t.valor else 0 end) > 0
    then round(
      (sum(case when t.tipo = 'receita' then t.valor else 0 end) -
       sum(case when t.tipo = 'custo'   then t.valor else 0 end) -
       sum(case when t.tipo = 'frete'   then t.valor else 0 end)) /
      sum(case when t.tipo = 'receita' then t.valor else 0 end) * 100, 1)
    else 0
  end as margem_pct
from itens_pedido ip
join produtos pr on pr.id = ip.produto_id
join pedidos p on p.id = ip.pedido_id
left join transacoes t on t.pedido_id = p.id
group by pr.categoria
order by receita desc;

create or replace view v_pedidos_completos as
select
  p.id,
  p.data,
  c.nome as cliente,
  pr.nome as produto,
  pr.categoria,
  p.loja,
  pr.fornecedor,
  p.status,
  p.pagamento,
  p.prazo_entrega,
  p.rastreio,
  p.avaliacao,
  ip.quantidade,
  ip.preco_venda,
  ip.frete,
  pr.custo,
  (ip.preco_venda * ip.quantidade) as receita,
  (pr.custo * ip.quantidade) as custo_total,
  ((ip.preco_venda * ip.quantidade) - (pr.custo * ip.quantidade) - ip.frete) as lucro
from pedidos p
join clientes c on c.id = p.cliente_id
join itens_pedido ip on ip.pedido_id = p.id
join produtos pr on pr.id = ip.produto_id
order by p.data desc;
