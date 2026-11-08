/** Binary things the company makes or receives: photos, voice samples, covers, audio, the book. */
import { q, one, id } from "./db.js";
import { uploadFile, fileUrl } from "./naive.js";
export async function putMedia({ order_id = null, kind, mime, bytes = null, url = null, naive_file_id = null, meta = {} }) {
  const mid = id("med");
  await q(`insert into media(id, order_id, kind, mime, bytes, url, naive_file_id, meta) values($1,$2,$3,$4,$5,$6,$7,$8)`, [mid, order_id, kind, mime, bytes, url, naive_file_id, JSON.stringify(meta)]);
  return mid;
}
export const getMedia = (mid) => one(`select * from media where id=$1`, [mid]);
export const listMedia = (order_id, kind) => q(`select id, kind, mime, meta, created_at, naive_file_id, url, octet_length(bytes) as size from media where order_id=$1 and kind=$2 order by created_at`, [order_id, kind]);
/** Best-effort mirror to Naïve Files (so the book and audio live on the platform too). */
export async function mirrorToNaive(mid, name) {
  const m = await getMedia(mid); if (!m?.bytes || m.naive_file_id) return m?.naive_file_id || null;
  try { const fid = await uploadFile(m.bytes, name, m.mime); await q(`update media set naive_file_id=$2 where id=$1`, [mid, fid]); return fid; } catch { return null; }
}
export async function mediaRedirectUrl(m) {
  if (m.url && (!m.meta?.url_expires || Date.now() < Number(m.meta.url_expires))) return m.url;
  if (m.naive_file_id) { const u = await fileUrl(m.naive_file_id); await q(`update media set url=$2, meta = meta || $3 where id=$1`, [m.id, u, JSON.stringify({ url_expires: Date.now() + 6 * 86400_000 })]); return u; }
  return null;
}
