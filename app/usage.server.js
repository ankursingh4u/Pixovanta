// Per-shop monthly file-operation metering.
//
// Plan quotas (see plans.server.js) are enforced against a counter that resets
// each calendar month. Usage is keyed by shop + period ("YYYY-MM"), so a fresh
// row is created at the start of every month and the previous month's count is
// preserved for reference.
import db from "./db.server";
import { FREE_PLAN } from "./plans.server";

// Current month as "YYYY-MM" (UTC). A new period string each month means a new
// counter row, which is how usage "resets".
export function currentPeriod() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// Read this shop's usage for the current period. Returns { period, filesUsed }
// without creating a row (a missing row means zero used).
export async function getUsage(shop) {
  const period = currentPeriod();
  const row = await db.usageCounter.findUnique({
    where: { shop_period: { shop, period } },
  });
  return { period, filesUsed: row?.filesUsed ?? 0 };
}

// Atomically add `n` to this shop's current-period counter, creating the row on
// first use. No-op for n <= 0. Returns the new total.
export async function incrementUsage(shop, n) {
  if (!n || n <= 0) return (await getUsage(shop)).filesUsed;
  const period = currentPeriod();
  const row = await db.usageCounter.upsert({
    where: { shop_period: { shop, period } },
    create: { shop, period, filesUsed: n },
    update: { filesUsed: { increment: n } },
  });
  return row.filesUsed;
}

// File operations this shop may still run this month under `plan` (>= 0).
export async function getRemaining(shop, plan) {
  const quota = (plan || FREE_PLAN).monthlyFiles;
  const { filesUsed } = await getUsage(shop);
  return Math.max(0, quota - filesUsed);
}

// Claim `n` file operations' worth of quota BEFORE doing the work, atomically.
//
// getRemaining() then incrementUsage() is only safe while one unit of work is in
// flight at a time. Now that several requests can be in flight at once, each
// request could read the same "1 remaining" and all proceed past the quota.
// Incrementing first and refunding when the result overshoots moves the
// decision into the database, where it can't race.
//
// Callers MUST refund what they reserve but don't use — a file that turns out
// not to need work costs the merchant nothing.
export async function reserveFiles(shop, plan, n = 1) {
  const quota = (plan || FREE_PLAN).monthlyFiles;
  const period = currentPeriod();

  let after;
  try {
    after = await bumpCounter(shop, period, n);
  } catch (err) {
    console.error("[USAGE] reserve failed for %s:", shop, err?.message || err);
    // Fail OPEN. A database blip must not block work a merchant has paid for;
    // under-counting briefly is the cheaper failure.
    return { allowed: true, quota, used: 0, remaining: quota };
  }

  // Unlimited plans are still counted so the usage meter stays honest; they
  // simply never overshoot.
  if (Number.isFinite(quota) && after > quota) {
    await refundFiles(shop, n);
    const used = Math.max(0, after - n);
    return { allowed: false, quota, used, remaining: Math.max(0, quota - used) };
  }

  return { allowed: true, quota, used: after, remaining: Math.max(0, quota - after) };
}

// Hand back a reservation that went unused.
export async function refundFiles(shop, n = 1) {
  if (!n || n <= 0) return;
  try {
    await db.usageCounter.update({
      where: { shop_period: { shop, period: currentPeriod() } },
      data: { filesUsed: { decrement: n } },
    });
  } catch (err) {
    // Over-counting by `n` is the failure mode. Logged rather than retried: the
    // merchant's operation already succeeded or failed on its own terms.
    console.error("[USAGE] refund failed for %s:", shop, err?.message || err);
  }
}

// The P2002 retry matters for the first operation of a month: two requests both see
// no row and both try to CREATE it, so one loses on the unique index. Retrying
// as a plain increment is correct — the row the winner made is the one we want.
async function bumpCounter(shop, period, n) {
  try {
    const row = await db.usageCounter.upsert({
      where: { shop_period: { shop, period } },
      create: { shop, period, filesUsed: n },
      update: { filesUsed: { increment: n } },
    });
    return row.filesUsed;
  } catch (err) {
    if (err?.code !== "P2002") throw err;
    const row = await db.usageCounter.update({
      where: { shop_period: { shop, period } },
      data: { filesUsed: { increment: n } },
    });
    return row.filesUsed;
  }
}
