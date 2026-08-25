const TRPC_RECONNECT_DELAY_MS = 450;

export function isHtmlApiFallback(response: Pick<Response, "headers">) {
  return (response.headers.get("content-type") ?? "").toLowerCase().includes("text/html");
}

export async function fetchTrpcWithRetry(input: RequestInfo | URL, init?: RequestInit) {
  let lastFailure: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await globalThis.fetch(input, {
        ...(init ?? {}),
        credentials: "include",
        cache: "no-store",
      });

      if (!isHtmlApiFallback(response)) return response;
      lastFailure = new Error("Faro received an API fallback response.");
    } catch (error) {
      lastFailure = error;
    }

    if (attempt < 2) await new Promise(resolve => globalThis.setTimeout(resolve, TRPC_RECONNECT_DELAY_MS * (attempt + 1)));
  }

  const suffix = lastFailure instanceof Error && lastFailure.message ? ` (${lastFailure.message})` : "";
  throw new Error(`Faro could not reach its API after reconnecting. Please retry in a moment.${suffix}`);
}
