import type { NextRequest } from "next/server";

// Ensure this route runs on the Node.js runtime (not Edge) for wider network compatibility
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Prefer server-only env var; fall back to NEXT_PUBLIC for local ease if needed
        const recipient =
            process.env.FORMSUBMIT_RECIPIENT ||
            process.env.NEXT_PUBLIC_FORMSUBMIT_RECIPIENT;

        if (!recipient) {
            return new Response(
                JSON.stringify({ error: "FormSubmit recipient is not configured" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        // Build Origin/Referer defaults to ensure FormSubmit sees a web context
        const defaultSiteUrl = (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3002");
        const incomingOrigin = req.headers.get("origin") || defaultSiteUrl;
        const incomingReferer = req.headers.get("referer") || `${defaultSiteUrl}/`;

        const url = `https://formsubmit.co/ajax/${encodeURIComponent(recipient)}`;
        // Add a timeout to avoid long hangs if upstream is unreachable
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);
        let upstream: Response;
        try {
            // FormSubmit is most reliable with form-encoded payloads even on the /ajax endpoint
            const formPayload = new URLSearchParams();
            Object.entries(body ?? {}).forEach(([k, v]) => {
                if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
                    formPayload.append(k, String(v));
                }
            });
            // Safe defaults: disable captcha for programmatic submissions; set a basic subject
            if (!formPayload.has("_captcha")) formPayload.append("_captcha", "false");
            if (!formPayload.has("_subject")) formPayload.append("_subject", "New submission");

            upstream = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Accept: "application/json",
                    // Forward Origin/Referer to satisfy FormSubmit checks
                    Origin: incomingOrigin,
                    Referer: incomingReferer,
                    // Provide a UA to avoid being treated as a headless/unknown agent
                    "User-Agent": "4na2dara3va2-app/1.0 (+https://github.com/maturelion/4na2dara3va2)",
                },
                body: formPayload.toString(),
                signal: controller.signal,
            });
        } catch (err: any) {
            clearTimeout(timeout);
            console.error("Upstream FormSubmit fetch error:", err);
            return new Response(
                JSON.stringify({
                    error:
                        err?.name === "AbortError"
                            ? "FormSubmit request timed out"
                            : `FormSubmit request failed: ${err?.message || "unknown error"}`,
                    code: err?.code || err?.cause?.code || null,
                    cause: err?.cause ? String(err.cause) : null,
                }),
                { status: 502, headers: { "Content-Type": "application/json" } }
            );
        } finally {
            clearTimeout(timeout);
        }

        const text = await upstream.text();
        let data: any = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch (e) {
            // If upstream didn't respond JSON, pass through raw text
            data = { message: text };
        }

        return new Response(JSON.stringify(data), {
            status: upstream.status,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("/api/email/formsubmit error:", error);
        return new Response(
            JSON.stringify({ error: error?.message || "Internal Server Error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}