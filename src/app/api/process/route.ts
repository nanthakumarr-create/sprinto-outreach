import { checkPasscode } from "@/lib/auth";
import { runPipeline, PipelineEvent } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Runs the 7-step pipeline for one company and streams progress as NDJSON. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!checkPasscode(req, body)) return Response.json({ error: "Wrong passcode" }, { status: 401 });
  if (!body.companyId) return Response.json({ error: "companyId required" }, { status: 400 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: PipelineEvent) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
        } catch {}
      };
      try {
        await runPipeline(body.companyId, emit);
      } finally {
        controller.enqueue(enc.encode(JSON.stringify({ step: "end", status: "done", message: "end" }) + "\n"));
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
