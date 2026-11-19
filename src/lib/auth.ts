import "server-only";

/** Write actions (run, send, rubric edits) need the passcode; viewing is public. */
export function checkPasscode(req: Request, body?: { passcode?: string }) {
  const expected = process.env.RUN_PASSCODE;
  if (!expected) return true;
  const got = body?.passcode ?? req.headers.get("x-passcode") ?? "";
  return got === expected;
}
