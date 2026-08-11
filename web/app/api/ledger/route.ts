import { NextResponse } from "next/server";
import { getLedger } from "@/lib/ledger.mjs";

export const runtime = "nodejs";

export async function GET() {
  const l = await getLedger();
  return NextResponse.json({ balance: l.balance, tx: l.tx.slice(-20).reverse() });
}