import { z } from "zod";
import { streamSchema } from "./contracts";
import type { InvestigationInput, StreamEvent } from "./contracts";

let csrf = "";
export const setCsrf = (value: string) => {
  csrf = value;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId = "",
  ) {
    super(message);
  }
}

async function check(response: Response): Promise<Response> {
  if (response.ok) return response;
  const data = await response.json().catch(() => null);
  if (response.status === 401)
    window.dispatchEvent(new Event("northstar:session-expired"));
  if (response.status === 502 || response.status === 503)
    throw new ApiError(
      "The workspace service is temporarily unavailable. Please retry in a moment.",
      response.status,
      data?.error?.request_id ?? "",
    );
  throw new ApiError(
    data?.error?.message ?? "The request could not be completed.",
    response.status,
    data?.error?.request_id ?? "",
  );
}

async function request(
  path: string,
  options: RequestInit = {},
  timeout = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  const signal = options.signal;
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    return await check(
      await fetch(`/api${path}`, {
        ...options,
        credentials: "same-origin",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
          ...options.headers,
        },
      }),
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted)
      throw new ApiError(
        "The request timed out or was cancelled. Check history before retrying an investigation.",
        0,
      );
    throw new ApiError(
      "The workspace service is unavailable. Confirm Northstar is running and retry.",
      0,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function api<T>(
  path: string,
  schema: z.ZodType<T>,
  options?: RequestInit,
): Promise<T> {
  const response = await request(path, options);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success)
    throw new ApiError(
      "The server returned an unexpected response. Please refresh or contact your administrator.",
      502,
      response.headers.get("X-Request-ID") ?? "",
    );
  return parsed.data;
}
export const mutate = (path: string, body: unknown, method = "POST") =>
  request(path, { method, body: JSON.stringify(body) });
export async function downloadReport(id: string) {
  const response = await mutate(`/investigations/${id}/report`, {
    approved: true,
  });
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `northstar-${id}.md`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function streamInvestigation(
  input: InvestigationInput,
  onEvent: (event: StreamEvent) => void,
  signal: AbortSignal,
) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort, { once: true });
  const timer = window.setTimeout(onAbort, 120000);
  let complete = false;
  try {
    const response = await check(
      await fetch("/api/investigations/stream", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(input),
      }),
    );
    if (!response.body) throw new Error("Streaming is unavailable.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      let separator: number;
      while ((separator = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        if (!frame.startsWith("data: ")) continue;
        const event = streamSchema.parse(JSON.parse(frame.slice(6)));
        onEvent(event);
        if (event.type === "error")
          throw new ApiError(event.message, 500, event.id);
        if (event.type === "result") complete = true;
      }
      if (chunk.done) break;
    }
    if (!complete)
      throw new ApiError(
        "The connection ended before results arrived. Check execution history; the investigation may still complete.",
        0,
      );
  } catch (error) {
    if (signal.aborted) return;
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "The investigation connection was interrupted. Check execution history before starting another run.",
      0,
    );
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}
