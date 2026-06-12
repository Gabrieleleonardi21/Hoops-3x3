/** ATTENZIONE: hashing client-side a scopo dimostrativo.
 *  In produzione l'autenticazione va fatta su un backend (es. bcrypt/argon2). */
export async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
