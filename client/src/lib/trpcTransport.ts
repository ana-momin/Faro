const TRPC_RECONNECT_DELAY_MS = 450;

export function isHtmlApiFallback(response: Pick<Response, "headers">) {
  return (response.headers.get("content-type") ?? "").toLowerCase().includes("text/html");
}

export async function fetchTrpcWithRetry(input: RequestInfo | URL, init?: RequestInit) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await globalThis.fetch(input, {
      ...(init ?? {}),
      credentials: "include",
      cache: "no-store",
    });

    if (!isHtmlApiFallback(response)) return response;
    if (attempt === 0) await new Promise(resolve => window.setTimeout(resolve, TRPC_RECONNECT_DELAY_MS));
  }

  throw new Error("Faro is reconnecting to its API. Please retry in a moment.");
}
