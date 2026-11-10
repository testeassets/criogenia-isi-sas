-- Criogenia ISI-SAS — banco no Supabase.
-- Rode este arquivo inteiro no SQL Editor do projeto (uma vez). Pode rodar de novo: ele é idempotente.
--
-- Como funciona
--  * O navegador só LÊ as tabelas (RLS). Toda alteração passa pelas funções crio_* abaixo, que rodam no servidor.
--  * Quem fez cada alteração vem do token do login (Google ou Microsoft), nunca de um campo enviado pelo navegador.
--  * Cada alteração grava uma linha em crio_registro (data/hora, nome, e-mail, ação, equipamento, local, amostra).
--  * Equipamento excluído e vial retirado não são apagados: ficam marcados com data e autor (o histórico é preservado).
--  * Acesso: se a tabela crio_acesso estiver vazia, qualquer conta Google/Microsoft que entrar pode usar.
--    Para restringir, cadastre e-mails ou domínios, por exemplo:
--      insert into crio_acesso (padrao) values ('@fieb.org.br'), ('@senaicimatec.edu.br'), ('fulano@gmail.com');

-- ───────────── tabelas ─────────────
create table if not exists crio_acesso (
  padrao text primary key check (padrao = lower(padrao) and length(padrao) between 3 and 200)
);

create table if not exists crio_equipamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('freezer', 'tanque')),
  nome text not null check (length(nome) between 1 and 120),
  modelo text not null default '',
  temperatura text not null default '',
  layout jsonb not null,
  limite_temperatura numeric,
  limite_nivel numeric,
  leitura_dias int check (leitura_dias between 1 and 60),
  ordem bigint not null default (extract(epoch from now()) * 1000)::bigint,
  criado_em timestamptz not null default now(),
  criado_por text not null default '',
  criado_email text not null default '',
  excluido_em timestamptz,
  excluido_por text,
  excluido_email text
);

create table if not exists crio_vials (
  id uuid primary key default gen_random_uuid(),
  codigo bigint generated always as identity unique,
  equipamento_id uuid not null references crio_equipamentos(id),
  caixa text not null,
  linha int not null check (linha between 1 and 12),
  coluna int not null check (coluna between 1 and 12),
  amostra text not null check (length(amostra) between 1 and 200),
  categoria text not null default '',
  detalhe text not null default '',
  meio text not null default '',
  congelado_em date,
  projeto text not null default '',
  observacao text not null default '',
  guardado_em timestamptz not null default now(),
  guardado_por text not null default '',
  guardado_email text not null default '',
  retirado_em timestamptz,
  retirado_por text,
  retirado_email text,
  motivo text,
  obs_retirada text
);
create unique index if not exists crio_vials_posicao on crio_vials (equipamento_id, caixa, linha, coluna) where retirado_em is null;
create index if not exists crio_vials_ativos on crio_vials (equipamento_id) where retirado_em is null;

create table if not exists crio_leituras (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid not null references crio_equipamentos(id),
  temperatura numeric,
  nivel numeric,
  reabastecido boolean not null default false,
  nota text not null default '',
  fora boolean not null default false,
  em timestamptz not null default now(),
  por_nome text not null default '',
  por_email text not null default ''
);
create index if not exists crio_leituras_eq on crio_leituras (equipamento_id, em desc);

create table if not exists crio_registro (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  usuario text not null,
  email text not null,
  acao text not null,
  equipamento_id uuid,
  equipamento text not null default '',
  local text not null default '',
  vial_id uuid,
  vial_codigo bigint,
  amostra text not null default '',
  detalhe text not null default ''
);
create index if not exists crio_registro_em on crio_registro (em desc);
create index if not exists crio_registro_vial on crio_registro (vial_id);

-- ───────────── identidade e acesso ─────────────
create or replace function crio_email() returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;
create or replace function crio_nome() returns text language sql stable as $$
  select coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''), nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
                  nullif(split_part(auth.jwt() ->> 'email', '@', 1), ''), 'Usuário')
$$;
create or replace function crio_pode() returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and crio_email() <> '' and (
    not exists (select 1 from crio_acesso)
    or exists (select 1 from crio_acesso a where crio_email() = a.padrao or (left(a.padrao, 1) = '@' and crio_email() like '%' || a.padrao)))
$$;
create or replace function crio_exigir() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not crio_pode() then raise exception 'Sua conta (%) não tem acesso a este sistema. Peça a liberação ao responsável.', crio_email() using errcode = '42501'; end if;
end $$;

-- Quem sou eu (o site usa para mostrar o nome e avisar quando a conta não tem acesso).
create or replace function crio_eu() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nome', crio_nome(), 'email', crio_email(), 'pode', crio_pode())
$$;

-- ───────────── apoio ─────────────
create or replace function crio_txt(p jsonb, k text, maximo int default 200) returns text language plpgsql immutable as $$
declare v text := btrim(coalesce(p ->> k, ''));
begin
  if length(v) > maximo then raise exception 'Campo % muito longo (máximo % caracteres).', k, maximo; end if;
  return v;
end $$;
create or replace function crio_num(p jsonb, k text) returns numeric language plpgsql immutable as $$
declare v text := replace(btrim(coalesce(p ->> k, '')), ',', '.');
begin
  if v = '' then return null; end if;
  if v !~ '^-?\d+(\.\d+)?$' then raise exception 'Valor numérico inválido em %: %', k, p ->> k; end if;
  return v::numeric;
end $$;
create or replace function crio_pos(l int, c int) returns text language sql immutable as $$ select substr('ABCDEFGHIJKL', l, 1) || c $$;

-- Valida a caixa ("c2/r3/k5" no ultrafreezer, "r3/k5" no botijão) e devolve o caminho legível.
create or replace function crio_caixa_local(e crio_equipamentos, caixa text) returns text language plpgsql immutable as $$
declare m text[]; nv int := (e.layout ->> 'niveis')::int; pf int := (e.layout ->> 'profundidade')::int;
begin
  if e.tipo = 'freezer' then
    m := regexp_match(caixa, '^c(\d+)/r(\d+)/k(\d+)$');
    if m is null or m[1]::int not between 1 and (e.layout ->> 'compartimentos')::int or m[2]::int not between 1 and (e.layout ->> 'racks')::int
       or m[3]::int not between 1 and nv * pf then raise exception 'Caixa inválida neste equipamento.'; end if;
    return 'Compartimento ' || m[1] || ' › Rack ' || m[1] || '.' || m[2] || ' › Caixa ' || m[3];
  end if;
  m := regexp_match(caixa, '^r(\d+)/k(\d+)$');
  if m is null or m[1]::int not between 1 and (e.layout ->> 'racks')::int then raise exception 'Caixa inválida neste equipamento.'; end if;
  -- Cada canister pode ter a própria quantidade de caixas (layout.canisters[i].caixas).
  nv := coalesce((e.layout -> 'canisters' -> (m[1]::int - 1) ->> 'caixas')::int, nv);
  if m[2]::int not between 1 and nv then raise exception 'Caixa inválida neste equipamento.'; end if;
  return 'Rack ' || m[1] || ' › Caixa ' || m[2];
end $$;

create or replace function crio_equip(p_id uuid) returns crio_equipamentos language plpgsql stable security definer set search_path = public as $$
declare e crio_equipamentos;
begin
  select * into e from crio_equipamentos where id = p_id and excluido_em is null;
  if not found then raise exception 'Equipamento não encontrado. Atualize a página.'; end if;
  return e;
end $$;

create or replace function crio_reg(p_acao text, e crio_equipamentos, p_local text, v crio_vials, p_detalhe text) returns void
language sql security definer set search_path = public as $$
  insert into crio_registro (usuario, email, acao, equipamento_id, equipamento, local, vial_id, vial_codigo, amostra, detalhe)
  values (crio_nome(), crio_email(), p_acao, e.id, coalesce(e.nome, ''), coalesce(p_local, ''), v.id, v.codigo, coalesce(v.amostra, ''), coalesce(p_detalhe, ''))
$$;

-- ───────────── equipamentos ─────────────
create or replace function crio_salvar_equipamento(p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare e crio_equipamentos; tipo text := p ->> 'tipo'; l jsonb := coalesce(p -> 'layout', '{}'); lim jsonb := coalesce(p -> 'limits', '{}');
  n_comp int; n_rack int; n_niv int; n_prof int; n_lin int; n_col int; mud text[] := '{}'; nome text := crio_txt(p, 'nome', 120);
begin
  perform crio_exigir();
  if nome = '' then raise exception 'Informe o nome do equipamento.'; end if;
  if coalesce(p ->> 'id', '') = '' then
    if tipo not in ('freezer', 'tanque') then raise exception 'Tipo de equipamento inválido.'; end if;
    n_comp := case when tipo = 'freezer' then coalesce((l ->> 'compartimentos')::int, 0) else 1 end;
    n_rack := coalesce((l ->> 'racks')::int, 0); n_niv := coalesce((l ->> 'niveis')::int, 0);
    n_prof := case when tipo = 'freezer' then coalesce((l ->> 'profundidade')::int, 0) else 1 end;
    n_lin := coalesce((l ->> 'linhas')::int, 0); n_col := coalesce((l ->> 'colunas')::int, 0);
    if least(n_comp, n_rack, n_niv, n_prof) < 1 or greatest(n_comp, n_rack, n_niv, n_prof) > 30 then raise exception 'Estrutura inválida: use números de 1 a 30.'; end if;
    if least(n_lin, n_col) < 1 or greatest(n_lin, n_col) > 12 then raise exception 'A caixa deve ter de 1 a 12 linhas e colunas.'; end if;
    if n_comp * n_rack * n_niv * n_prof > 1000 then raise exception 'Estrutura grande demais (máximo de 1000 caixas por equipamento).'; end if;
    insert into crio_equipamentos (tipo, nome, modelo, temperatura, layout, limite_temperatura, limite_nivel, leitura_dias, criado_por, criado_email)
    values (tipo, nome, crio_txt(p, 'modelo', 120), crio_txt(p, 'temperatura', 40),
      jsonb_build_object('compartimentos', n_comp, 'racks', n_rack, 'niveis', n_niv, 'profundidade', n_prof, 'linhas', n_lin, 'colunas', n_col),
      crio_num(lim, 'maxTemperature'), crio_num(lim, 'minLevel'), crio_num(lim, 'readEveryDays')::int, crio_nome(), crio_email())
    returning * into e;
    perform crio_reg('Equipamento adicionado', e, '', null, concat_ws(' · ', nullif(e.modelo, ''), nullif(e.temperatura, ''),
      case when tipo = 'freezer' then n_comp || ' compartimentos × ' || n_rack || ' racks' else n_rack || ' racks' end,
      (n_comp * n_rack * n_niv * n_prof) || ' caixas ' || n_lin || '×' || n_col));
    return e.id;
  end if;
  e := crio_equip((p ->> 'id')::uuid);
  if e.nome <> nome then mud := mud || ('nome: ' || e.nome || ' → ' || nome); end if;
  if e.modelo <> crio_txt(p, 'modelo', 120) then mud := mud || ('modelo: ' || e.modelo || ' → ' || crio_txt(p, 'modelo', 120)); end if;
  if e.temperatura <> crio_txt(p, 'temperatura', 40) then mud := mud || ('temperatura: ' || e.temperatura || ' → ' || crio_txt(p, 'temperatura', 40)); end if;
  update crio_equipamentos set nome = crio_txt(p, 'nome', 120), modelo = crio_txt(p, 'modelo', 120), temperatura = crio_txt(p, 'temperatura', 40),
    limite_temperatura = crio_num(lim, 'maxTemperature'), limite_nivel = crio_num(lim, 'minLevel'), leitura_dias = crio_num(lim, 'readEveryDays')::int
    where id = e.id returning * into e;
  perform crio_reg('Equipamento editado', e, '', null, coalesce(nullif(array_to_string(mud, '; '), ''), 'limites de alerta'));
  return e.id;
end $$;

-- Canisters do botijão: cor e quantidade de caixas de cada um. Não deixa sumir caixa com vial guardado.
create or replace function crio_salvar_canisters(p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare e crio_equipamentos; lista jsonb := p -> 'canisters'; novos jsonb := '[]'; c jsonb; i int := 0; cx int; cor text; v crio_vials; m text[]; ant int;
begin
  perform crio_exigir();
  e := crio_equip((p ->> 'id')::uuid);
  if e.tipo <> 'tanque' then raise exception 'Só o botijão tem canisters.'; end if;
  if jsonb_typeof(lista) is distinct from 'array' or jsonb_array_length(lista) not between 1 and 30 then raise exception 'O botijão deve ter de 1 a 30 canisters.'; end if;
  for c in select value from jsonb_array_elements(lista) loop
    i := i + 1; cor := lower(coalesce(c ->> 'cor', ''));
    if cor !~ '^#[0-9a-f]{6}$' then raise exception 'Cor inválida no canister %.', i; end if;
    if coalesce(c ->> 'caixas', '') !~ '^\d{1,3}$' or (c ->> 'caixas')::int not between 1 and 30 then raise exception 'O canister % deve ter de 1 a 30 caixas.', i; end if;
    novos := novos || jsonb_build_array(jsonb_build_object('cor', cor, 'caixas', (c ->> 'caixas')::int));
  end loop;
  if (select sum((x ->> 'caixas')::int) from jsonb_array_elements(novos) x) > 1000 then raise exception 'Estrutura grande demais (máximo de 1000 caixas por equipamento).'; end if;
  for v in select * from crio_vials where equipamento_id = e.id and retirado_em is null loop
    m := regexp_match(v.caixa, '^r(\d+)/k(\d+)$');
    if m is null or m[1]::int > jsonb_array_length(novos) or m[2]::int > (novos -> (m[1]::int - 1) ->> 'caixas')::int then
      raise exception 'Há vials guardados em %. Retire ou mova os vials antes de remover essa caixa ou canister.', crio_caixa_local(e, v.caixa); end if;
  end loop;
  ant := (e.layout ->> 'racks')::int;
  update crio_equipamentos set layout = layout || jsonb_build_object('racks', jsonb_array_length(novos),
      'niveis', (select max((x ->> 'caixas')::int) from jsonb_array_elements(novos) x), 'canisters', novos)
    where id = e.id returning * into e;
  perform crio_reg('Canisters editados', e, '', null, ant || ' → ' || jsonb_array_length(novos) || ' canisters; caixas: '
    || (select string_agg(x ->> 'caixas', ', ' order by n) from jsonb_array_elements(novos) with ordinality t(x, n)));
  return e.id;
end $$;

create or replace function crio_excluir_equipamento(p jsonb) returns void language plpgsql security definer set search_path = public as $$
declare e crio_equipamentos; n int;
begin
  perform crio_exigir();
  e := crio_equip((p ->> 'id')::uuid);
  select count(*) into n from crio_vials where equipamento_id = e.id and retirado_em is null;
  if n > 0 then raise exception 'Ainda há % vial(s) guardado(s) neste equipamento. Retire ou mova os vials antes de excluir.', n; end if;
  update crio_equipamentos set excluido_em = now(), excluido_por = crio_nome(), excluido_email = crio_email() where id = e.id;
  perform crio_reg('Equipamento excluído', e, '', null, concat_ws(' · ', nullif(e.modelo, ''), nullif(e.temperatura, '')));
end $$;

-- ───────────── vials ─────────────
create or replace function crio_guardar_vials(p jsonb) returns int language plpgsql security definer set search_path = public as $$
declare e crio_equipamentos; caixa text := p ->> 'caixa'; loc text; pos jsonb; v crio_vials; n int := 0; li int; co int;
  amostra text := crio_txt(p, 'amostra', 200); cong date;
begin
  perform crio_exigir();
  e := crio_equip((p ->> 'equipamentoId')::uuid);
  loc := crio_caixa_local(e, caixa);
  if amostra = '' then raise exception 'Informe o nome da amostra.'; end if;
  begin cong := nullif(p ->> 'congeladoEm', '')::date; exception when others then raise exception 'Data de congelamento inválida.'; end;
  if jsonb_array_length(coalesce(p -> 'posicoes', '[]')) = 0 then raise exception 'Escolha ao menos uma posição.'; end if;
  for pos in select * from jsonb_array_elements(p -> 'posicoes') loop
    li := (pos ->> 'linha')::int; co := (pos ->> 'coluna')::int;
    if li not between 1 and (e.layout ->> 'linhas')::int or co not between 1 and (e.layout ->> 'colunas')::int then raise exception 'Posição fora da caixa.'; end if;
    begin
      insert into crio_vials (equipamento_id, caixa, linha, coluna, amostra, categoria, detalhe, meio, congelado_em, projeto, observacao, guardado_por, guardado_email)
      values (e.id, caixa, li, co, amostra, crio_txt(p, 'categoria', 40), crio_txt(p, 'detalhe', 200), crio_txt(p, 'meio', 120), cong,
              crio_txt(p, 'projeto', 200), crio_txt(p, 'observacao', 1000), crio_nome(), crio_email())
      returning * into v;
    exception when unique_violation then raise exception 'A posição % já está ocupada. Atualize a página.', crio_pos(li, co);
    end;
    perform crio_reg('Vial guardado', e, loc || ' › ' || crio_pos(li, co), v, concat_ws(' · ', nullif(v.detalhe, ''), nullif(v.categoria, '')));
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function crio_vial_ativo(p_id uuid) returns crio_vials language plpgsql security definer set search_path = public as $$
declare v crio_vials;
begin
  select * into v from crio_vials where id = p_id and retirado_em is null for update;
  if not found then raise exception 'Vial não encontrado ou já retirado. Atualize a página.'; end if;
  return v;
end $$;

create or replace function crio_editar_vial(p jsonb) returns void language plpgsql security definer set search_path = public as $$
declare v crio_vials; n crio_vials; e crio_equipamentos; mud text[] := '{}'; cong date;
begin
  perform crio_exigir();
  v := crio_vial_ativo((p ->> 'id')::uuid); e := crio_equip(v.equipamento_id);
  if crio_txt(p, 'amostra', 200) = '' then raise exception 'Informe o nome da amostra.'; end if;
  begin cong := nullif(p ->> 'congeladoEm', '')::date; exception when others then raise exception 'Data de congelamento inválida.'; end;
  update crio_vials set amostra = crio_txt(p, 'amostra', 200), categoria = crio_txt(p, 'categoria', 40), detalhe = crio_txt(p, 'detalhe', 200),
    meio = crio_txt(p, 'meio', 120), congelado_em = cong, projeto = crio_txt(p, 'projeto', 200), observacao = crio_txt(p, 'observacao', 1000)
    where id = v.id returning * into n;
  if v.amostra <> n.amostra then mud := mud || ('amostra: ' || v.amostra || ' → ' || n.amostra); end if;
  if v.categoria <> n.categoria then mud := mud || ('categoria: ' || v.categoria || ' → ' || n.categoria); end if;
  if v.detalhe <> n.detalhe then mud := mud || ('detalhe: ' || v.detalhe || ' → ' || n.detalhe); end if;
  if v.meio <> n.meio then mud := mud || ('meio: ' || v.meio || ' → ' || n.meio); end if;
  if v.congelado_em is distinct from n.congelado_em then mud := mud || ('congelado em: ' || coalesce(to_char(v.congelado_em, 'DD/MM/YYYY'), '—') || ' → ' || coalesce(to_char(n.congelado_em, 'DD/MM/YYYY'), '—')); end if;
  if v.projeto <> n.projeto then mud := mud || ('projeto: ' || v.projeto || ' → ' || n.projeto); end if;
  if v.observacao <> n.observacao then mud := mud || 'observação alterada'::text; end if;
  perform crio_reg('Vial editado', e, crio_caixa_local(e, v.caixa) || ' › ' || crio_pos(v.linha, v.coluna), n, coalesce(nullif(array_to_string(mud, '; '), ''), 'sem mudanças'));
end $$;

create or replace function crio_retirar_vial(p jsonb) returns void language plpgsql security definer set search_path = public as $$
declare v crio_vials; e crio_equipamentos; v_motivo text := coalesce(p ->> 'motivo', '');
begin
  perform crio_exigir();
  if v_motivo not in ('Uso', 'Descarte', 'Transferência', 'Perda') then raise exception 'Motivo de retirada inválido.'; end if;
  v := crio_vial_ativo((p ->> 'id')::uuid); e := crio_equip(v.equipamento_id);
  update crio_vials set retirado_em = now(), retirado_por = crio_nome(), retirado_email = crio_email(), motivo = v_motivo, obs_retirada = crio_txt(p, 'observacao', 500)
    where id = v.id;
  perform crio_reg('Vial retirado', e, crio_caixa_local(e, v.caixa) || ' › ' || crio_pos(v.linha, v.coluna), v, concat_ws(' · ', v_motivo, nullif(crio_txt(p, 'observacao', 500), '')));
end $$;

create or replace function crio_mover_vial(p jsonb) returns void language plpgsql security definer set search_path = public as $$
declare v crio_vials; e crio_equipamentos; d crio_equipamentos; caixa text := p ->> 'caixa'; li int := (p ->> 'linha')::int; co int := (p ->> 'coluna')::int; de text; para text;
begin
  perform crio_exigir();
  v := crio_vial_ativo((p ->> 'id')::uuid); e := crio_equip(v.equipamento_id); d := crio_equip((p ->> 'equipamentoId')::uuid);
  para := crio_caixa_local(d, caixa);
  if li not between 1 and (d.layout ->> 'linhas')::int or co not between 1 and (d.layout ->> 'colunas')::int then raise exception 'Posição % não existe nessa caixa.', crio_pos(li, co); end if;
  de := e.nome || ' › ' || crio_caixa_local(e, v.caixa) || ' › ' || crio_pos(v.linha, v.coluna);
  begin
    update crio_vials set equipamento_id = d.id, caixa = p ->> 'caixa', linha = li, coluna = co where id = v.id returning * into v;
  exception when unique_violation then raise exception 'A posição % já está ocupada.', crio_pos(li, co);
  end;
  perform crio_reg('Vial movido', d, para || ' › ' || crio_pos(li, co), v, 'de ' || de);
end $$;

-- ───────────── leituras (temperatura / nível de N₂) ─────────────
create or replace function crio_registrar_leitura(p jsonb) returns void language plpgsql security definer set search_path = public as $$
declare e crio_equipamentos; t numeric := crio_num(p, 'temperature'); n numeric := crio_num(p, 'level'); fora boolean;
  reab boolean := coalesce((p ->> 'refilled')::boolean, false);
begin
  perform crio_exigir();
  e := crio_equip((p ->> 'equipmentId')::uuid);
  if t is null and n is null and not reab then raise exception 'Informe a temperatura ou o nível de N₂.'; end if;
  fora := (e.tipo = 'freezer' and t is not null and e.limite_temperatura is not null and t > e.limite_temperatura)
       or (e.tipo = 'tanque' and n is not null and e.limite_nivel is not null and n < e.limite_nivel);
  insert into crio_leituras (equipamento_id, temperatura, nivel, reabastecido, nota, fora, por_nome, por_email)
  values (e.id, t, n, reab, crio_txt(p, 'note', 500), fora, crio_nome(), crio_email());
  perform crio_reg('Leitura registrada', e, '', null, concat_ws(' · ', t || ' °C', n || ' cm de N₂', case when reab then 'reabastecido' end,
    case when fora then 'FORA DO LIMITE' end, nullif(crio_txt(p, 'note', 500), '')));
end $$;

-- ───────────── permissões ─────────────
alter table crio_acesso enable row level security;
alter table crio_equipamentos enable row level security;
alter table crio_vials enable row level security;
alter table crio_leituras enable row level security;
alter table crio_registro enable row level security;
drop policy if exists crio_ler on crio_equipamentos; create policy crio_ler on crio_equipamentos for select to authenticated using (crio_pode());
drop policy if exists crio_ler on crio_vials;        create policy crio_ler on crio_vials        for select to authenticated using (crio_pode());
drop policy if exists crio_ler on crio_leituras;     create policy crio_ler on crio_leituras     for select to authenticated using (crio_pode());
drop policy if exists crio_ler on crio_registro;     create policy crio_ler on crio_registro     for select to authenticated using (crio_pode());
-- crio_acesso: sem política = ninguém lê nem altera pelo site (gerencie pelo painel do Supabase).

revoke all on crio_acesso, crio_equipamentos, crio_vials, crio_leituras, crio_registro from anon, authenticated;
grant select on crio_equipamentos, crio_vials, crio_leituras, crio_registro to authenticated;

do $$ declare f text; begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'crio\_%' loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
end $$;
