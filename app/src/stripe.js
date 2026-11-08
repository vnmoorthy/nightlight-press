/** Money is deterministic code: Stripe Checkout for $19 a book; without a key, honest pledge mode. */
import Stripe from "stripe";
import { q, one, ledger } from "./db.js";
const KEY = /^(sk|rk)_(live|test)_/.test(process.env.STRIPE_SECRET_KEY || "") ? process.env.STRIPE_SECRET_KEY : null;
export const stripe = KEY ? new Stripe(KEY) : null;
export const PRICE_CENTS = Number(process.env.PRICE_CENTS || 1900);
export const mode = () => (stripe ? (/_live_/.test(KEY) ? "live" : "test") : "pledge");
export async function startCheckout(order, baseUrl) {
  if (!stripe) {
    await q(`update orders set paid_mode='pledge', status='paid', captured_cents=0 where id=$1`, [order.id]);
    await ledger("payment", "code", { mode: "pledge", amount_cents: order.amount_cents, note: "no Stripe key on this instance; nothing charged" }, order.id);
    return { url: `${baseUrl}/order/${order.id}`, paid: true };
  }
  const s = await stripe.checkout.sessions.create({
    mode: "payment", customer_email: order.buyer_email || undefined,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: order.amount_cents, product_data: { name: `A picture book starring ${order.child_name}`, description: "Written, illustrated, narrated and bound by Nightlight Press. Ready in minutes." } } }],
    metadata: { order_id: order.id }, success_url: `${baseUrl}/order/${order.id}?cs={CHECKOUT_SESSION_ID}`, cancel_url: `${baseUrl}/?cancelled=1#make`,
  });
  await q(`update orders set checkout_session_id=$2, paid_mode=$3 where id=$1`, [order.id, s.id, mode()]);
  await ledger("checkout", "code", { mode: mode(), session: s.id, amount_cents: order.amount_cents }, order.id);
  return { url: s.url, paid: false };
}
export async function confirmCheckout(order_id, csId) {
  if (!stripe) return { ok: true };
  const o = await one(`select * from orders where id=$1`, [order_id]); if (!o) return { ok: false };
  if (["paid", "making", "ready", "delivered"].includes(o.status)) return { ok: true, already: true };
  const s = await stripe.checkout.sessions.retrieve(csId || o.checkout_session_id);
  if (s.metadata?.order_id !== order_id || s.payment_status !== "paid") return { ok: false, status: s.payment_status };
  await q(`update orders set status='paid', captured_cents=$2, payment_intent=$3 where id=$1`, [order_id, s.amount_total, String(s.payment_intent || "")]);
  await ledger("payment", "code", { mode: mode(), amount_cents: s.amount_total, payment_intent: s.payment_intent }, order_id);
  return { ok: true, paid: true };
}
