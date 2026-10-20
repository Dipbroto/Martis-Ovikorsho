// Supabase Edge Function: server-side proxy for the Gemini API.
// The API key lives only in the function's secrets and is never sent to the browser.
//
//   supabase secrets set GEMINI_API_KEY=<your key>
//   supabase functions deploy gemini-proxy
//
// Deno runtime; types for `Deno` come from the Supabase edge runtime.

const ALLOWED_MODELS = new Set(["gemini-2.5-flash"]);
const MAX_BODY_BYTES = 64 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "GEMINI_API_KEY is not configured" }, 500);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413);

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { model = "gemini-2.5-flash", contents, systemInstruction, tools, generationConfig } = payload as {
    model?: string;
    contents?: unknown;
    systemInstruction?: unknown;
    tools?: unknown;
    generationConfig?: unknown;
  };

  if (!ALLOWED_MODELS.has(model)) return json({ error: "Model not allowed" }, 400);
  if (!Array.isArray(contents) || contents.length === 0) return json({ error: "`contents` is required" }, 400);

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents, systemInstruction, tools, generationConfig }),
    },
  );

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
