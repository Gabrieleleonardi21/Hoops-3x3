/** Autenticazione DIMOSTRATIVA su storage locale.
 *  In produzione: backend con sessioni/JWT e hashing lato server. */
import { storage } from "./storage";
import { sha256 } from "../utils/sha256";
import type { Account, User } from "../types";

const KEY = "account";

export async function loadAccount(): Promise<Account | null> {
  try {
    const a = await storage.get(KEY);
    return JSON.parse(a.value) as Account;
  } catch {
    return null;
  }
}

export async function register(name: string, email: string, pass: string): Promise<User> {
  const acc: Account = { name: name.trim(), email: email.trim().toLowerCase(), hash: await sha256(pass) };
  await storage.set(KEY, JSON.stringify(acc));
  return { name: acc.name, email: acc.email, guest: false };
}

export async function login(account: Account, email: string, pass: string): Promise<User | null> {
  const ok = email.trim().toLowerCase() === account.email && (await sha256(pass)) === account.hash;
  return ok ? { name: account.name, email: account.email, guest: false } : null;
}
