const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = (() => {
  const t = new Uint8Array(256).fill(255);
  for (let i = 0; i < ALPHABET.length; i++) t[ALPHABET.charCodeAt(i)] = i;
  t["-".charCodeAt(0)] = 62;
  t["_".charCodeAt(0)] = 63;
  return t;
})();

/** Base64 (or a "data:…;base64," URL) → bytes, for uploading a drawn signature. */
export function base64ToBytes(input: string): Uint8Array {
  const b64 = input.includes(",") ? input.slice(input.indexOf(",") + 1) : input;
  const clean = b64.replace(/[^A-Za-z0-9+/_-]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)];
    const b = LOOKUP[clean.charCodeAt(i + 1)];
    const c = i + 2 < clean.length ? LOOKUP[clean.charCodeAt(i + 2)] : 255;
    const d = i + 3 < clean.length ? LOOKUP[clean.charCodeAt(i + 3)] : 255;
    out[o++] = (a << 2) | (b >> 4);
    if (c !== 255) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d !== 255) out[o++] = ((c & 3) << 6) | d;
  }
  return out.slice(0, o);
}
