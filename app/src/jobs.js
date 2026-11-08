/** A tiny durable job queue with leases. Every step of the company is a job; every step is short. */
import { q, one } from "./db.js";

export class Retry extends Error { constructor(msg, ms = 8000) { super(msg); this.retryMs = ms; } }

export async function enqueue(kind, { order_id = null, book_id = null, page_id = null, payload = {}, delayMs = 0 } = {}) {
  return one(`insert into jobs(kind, order_id, book_id, page_id, payload, next_run_at) values($1,$2,$3,$4,$5, now() + ($6 || ' milliseconds')::interval) returning id`, [kind, order_id, book_id, page_id, JSON.stringify(payload), String(Math.max(0, Math.round(delayMs)))]);
}
export async function claim() {
  return one(`update jobs set lease_until = now() + interval '40 seconds', polls = polls + 1, updated_at = now()
    where id = (select id from jobs where status in ('queued','waiting') and next_run_at <= now() and (lease_until is null or lease_until < now())
                order by next_run_at, id limit 1 for update skip locked)
    returning *`);
}
export async function park(job, { ms = 3000, ref, step, payload } = {}) {
  await q(`update jobs set status='waiting', lease_until=null, next_run_at = now() + ($2 || ' milliseconds')::interval, ref = coalesce($3, ref), step = coalesce($4, step), payload = coalesce($5, payload), updated_at=now() where id=$1`,
    [job.id, String(Math.round(ms)), ref ?? null, step ?? null, payload ? JSON.stringify(payload) : null]);
  return "parked";
}
export async function done(job, result = {}) {
  await q(`update jobs set status='done', lease_until=null, result=$2, updated_at=now() where id=$1`, [job.id, JSON.stringify(result ?? {})]);
  return "done";
}
export async function fail(job, err) {
  const retryMs = err?.retryMs;
  const msg = String(err?.message || err).slice(0, 500);
  if (retryMs) { await q(`update jobs set status='waiting', lease_until=null, next_run_at = now() + ($2 || ' milliseconds')::interval, error=$3, updated_at=now() where id=$1`, [job.id, String(retryMs), msg]); return "retry"; }
  const r = await one(`update jobs set errors = errors + 1, error=$2, lease_until=null, updated_at=now(),
      status = case when errors + 1 >= 4 then 'failed' else 'waiting' end,
      next_run_at = now() + ((errors + 1) * 15 || ' seconds')::interval where id=$1 returning status`, [job.id, msg]);
  return r?.status === "failed" ? "failed" : "retry";
}
export async function activeJobs(limit = 40) {
  return q(`select id, kind, order_id, book_id, page_id, status, step, polls, errors, created_at, updated_at, next_run_at from jobs where status in ('queued','waiting') order by created_at limit $1`, [limit]);
}
