/** Local credits ledger (Flow D) — free store, no DB. Renders are metered. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "ledger.json");

export const START_BALANCE = 100;
/** 1 credit per 15 seconds of rendered video (round up, min 1). */
export const costFor = (totalSeconds) => Math.max(1, Math.ceil(totalSeconds / 15));

export async function getLedger() {
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    return { balance: START_BALANCE, tx: [] };
  }
}

export async function saveLedger(l) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(l, null, 2));
}

export async function debit(amount, reason) {
  const l = await getLedger();
  if (l.balance < amount) {
    throw Object.assign(new Error(`insufficient credits: need ${amount}, have ${l.balance}`), { code: "INSUFFICIENT" });
  }
  l.balance -= amount;
  l.tx.push({ kind: "debit", amount, reason, at: new Date().toISOString() });
  await saveLedger(l);
  return l;
}

export async function credit(amount, reason) {
  const l = await getLedger();
  l.balance += amount;
  l.tx.push({ kind: "credit", amount, reason, at: new Date().toISOString() });
  await saveLedger(l);
  return l;
}