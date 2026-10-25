import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
let db;
const admin = "00000000-0000-4000-8000-000000000001",
  staff = "00000000-0000-4000-8000-000000000002",
  requester = "00000000-0000-4000-8000-000000000003",
  other = "00000000-0000-4000-8000-000000000004";
async function as(user, sql) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`,
  );
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
  }
}
async function request(group = "O+", quantity = 2) {
  const r = await as(
    requester,
    `select public.create_request('DEMO-PATIENT','${group}',${quantity}) as id`,
  );
  return r.rows[0].id;
}
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(
    await readFile(
      new URL("../database/001_schema.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const [id, role] of [
    [admin, "admin"],
    [staff, "staff"],
    [requester, "requester"],
    [other, "requester"],
  ])
    await db.exec(
      `insert into auth.users(id) values('${id}');update public.profiles set role='${role}' where user_id='${id}';`,
    );
  await db.exec(
    await readFile(
      new URL("../database/002_demo_data.sql", import.meta.url),
      "utf8",
    ),
  );
});
after(async () => {
  await db?.close();
});
test("anonymous cannot read protected inventory or invoke stock functions", async () => {
  await db.exec("set role anon");
  try {
    await assert.rejects(
      db.query("select * from public.blood_units"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.reserve_request(1)"),
      /permission denied/,
    );
  } finally {
    await db.exec("reset role");
  }
});
test("new accounts receive requester role and cannot promote themselves", async () => {
  assert.equal(
    (await as(requester, "select role from public.profiles")).rows[0].role,
    "requester",
  );
  await assert.rejects(
    as(
      requester,
      `update public.profiles set role='admin' where user_id='${requester}'`,
    ),
    /permission denied/,
  );
  await assert.rejects(
    as(requester, `select public.set_role('${other}','admin')`),
    /Administrator/,
  );
  await assert.rejects(
    as(requester, "select public.add_donor('No','x','O+')"),
    /Staff/,
  );
});
test("FEFO reserves earliest eligible units, excludes quarantine and expiry, repeats safely", async () => {
  const id = await request();
  await as(
    staff,
    `select public.approve_request(${id},'Staff approved compatibility')`,
  );
  const r = await as(staff, `select public.reserve_request(${id}) as units`);
  assert.deepEqual(r.rows[0].units, ["BF-011", "BF-012"]);
  assert.deepEqual(
    (await as(staff, `select public.reserve_request(${id}) as units`)).rows[0]
      .units,
    r.rows[0].units,
  );
  assert.equal(
    (
      await db.query(
        `select count(*)::int as n from public.allocations where request_id=${id}`,
      )
    ).rows[0].n,
    2,
  );
  await as(staff, `select public.issue_request(${id})`);
  await as(staff, `select public.issue_request(${id})`);
  await assert.rejects(
    as(staff, `select public.cancel_request(${id})`),
    /Issued/,
  );
});
test("insufficient inventory leaves request and allocations unchanged", async () => {
  const id = await request("A+", 3);
  await as(staff, `select public.approve_request(${id},'Approved by staff')`);
  await assert.rejects(
    as(staff, `select public.reserve_request(${id})`),
    /Insufficient/,
  );
  assert.equal(
    (
      await db.query(
        `select status from public.requests where request_id=${id}`,
      )
    ).rows[0].status,
    "approved",
  );
  assert.equal(
    (
      await db.query(
        `select count(*)::int as n from public.allocations where request_id=${id}`,
      )
    ).rows[0].n,
    0,
  );
});
test("competing requests cannot obtain the same last unit; unique index is a second safeguard", async () => {
  const a = await request("B+", 2),
    b = await request("B+", 1);
  for (const id of [a, b])
    await as(staff, `select public.approve_request(${id},'Approved by staff')`);
  await as(staff, `select public.reserve_request(${a})`);
  await assert.rejects(
    as(staff, `select public.reserve_request(${b})`),
    /Insufficient/,
  );
  await assert.rejects(
    db.query(
      `insert into public.allocations(request_id,unit_id,status) values(${b},'BF-031','reserved')`,
    ),
    /duplicate key/,
  );
  await as(staff, `select public.cancel_request(${a})`);
  await as(staff, `select public.reserve_request(${b})`);
  assert.equal(
    (
      await db.query(
        `select count(*)::int as n from public.allocations where unit_id='BF-031' and status='reserved'`,
      )
    ).rows[0].n,
    1,
  );
});
test("issue rechecks expiry and leaves reserved records intact on failure", async () => {
  const id = await request("A-", 1);
  await as(staff, `select public.approve_request(${id},'Approved by staff')`);
  await as(staff, `select public.reserve_request(${id})`);
  await db.exec(
    "update public.blood_units set expires_at=now()-interval '1 minute' where unit_id='BF-061'",
  );
  await assert.rejects(
    as(staff, `select public.issue_request(${id})`),
    /expired or unusable/,
  );
  assert.equal(
    (
      await db.query(
        `select status from public.requests where request_id=${id}`,
      )
    ).rows[0].status,
    "reserved",
  );
  await as(requester, `select public.cancel_request(${id})`);
});
test("requesters read only their requests, cannot allocate, and cannot cancel another account request", async () => {
  const r = await as(
      other,
      "select public.create_request('OTHER','AB+',1) as id",
    ),
    id = r.rows[0].id;
  assert.equal(
    (
      await as(
        requester,
        `select * from public.requests where request_id=${id}`,
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (await as(requester, "select * from public.donors")).rows.length,
    0,
  );
  await assert.rejects(
    as(requester, `select public.cancel_request(${id})`),
    /Access denied/,
  );
  await assert.rejects(
    as(requester, `select public.reserve_request(${id})`),
    /Staff/,
  );
  await assert.rejects(
    as(
      requester,
      `insert into public.requests(requester_id,patient_ref,blood_group,quantity) values('${other}','X','O+',1)`,
    ),
    /permission denied/,
  );
});
test("quarantine release requires staff note; invalid expiry and quantities fail", async () => {
  await assert.rejects(
    as(staff, "select public.review_unit('BF-013','released','')"),
    /note/,
  );
  await as(
    staff,
    "select public.review_unit('BF-013','released','Screening passed DEMO')",
  );
  assert.equal(
    (
      await db.query(
        "select release_status from public.blood_units where unit_id='BF-013'",
      )
    ).rows[0].release_status,
    "released",
  );
  await assert.rejects(
    as(staff, "select public.add_unit(1,'BAD',now(),now()-interval '1 day')"),
    /Expiry/,
  );
  await assert.rejects(request("O+", 0), /check constraint/);
});
test("heartbeats deduplicate users, server sessions create login events, stale activity expires", async () => {
  await as(admin, "select public.heartbeat()");
  await as(admin, "select public.heartbeat()");
  await db.exec(
    `insert into auth.sessions values('00000000-0000-4000-8000-000000000010','${admin}')`,
  );
  let stats = (await as(admin, "select public.user_statistics() as stats"))
    .rows[0].stats;
  assert.equal(stats.registered, 4);
  assert.equal(stats.active, 1);
  assert.equal(stats.today, 1);
  await db.exec(
    "update public.user_activity set last_seen_at=now()-interval '6 minutes'",
  );
  stats = (await as(admin, "select public.user_statistics() as stats")).rows[0]
    .stats;
  assert.equal(stats.active, 0);
  await assert.rejects(
    as(staff, "select public.user_statistics()"),
    /Administrator/,
  );
  await assert.rejects(
    as(
      admin,
      `insert into public.login_events(user_id,session_ref) values('${admin}','00000000-0000-4000-8000-000000000020')`,
    ),
    /permission denied/,
  );
});
test("audit history is server attributed and protected", async () => {
  assert.ok(
    (await db.query("select count(*)::int as n from public.audit_events"))
      .rows[0].n > 0,
  );
  assert.equal(
    (await as(requester, "select * from public.audit_events")).rows.length,
    0,
  );
  await assert.rejects(
    as(staff, "select public.audit('Forged','X')"),
    /permission denied/,
  );
  await assert.rejects(
    as(staff, "delete from public.audit_events"),
    /permission denied/,
  );
});
