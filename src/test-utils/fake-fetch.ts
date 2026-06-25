/**
 * Test helper: a `fetch` stand-in that returns queued JSON responses and
 * records the requests it received. Keeps provider tests free of real network
 * calls.
 */

export interface FakeResponse {
  status?: number;
  body: unknown;
}

export interface RecordedRequest {
  url: string;
  init?: RequestInit;
}

export interface FakeFetch {
  fetchImpl: typeof fetch;
  requests: RecordedRequest[];
}

export function createFakeFetch(responses: FakeResponse[]): FakeFetch {
  const queue = [...responses];
  const requests: RecordedRequest[] = [];

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    const next = queue.shift();
    if (!next) {
      throw new Error("createFakeFetch: no more queued responses");
    }
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  return { fetchImpl, requests };
}
