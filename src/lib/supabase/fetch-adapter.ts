/**
 * Resilient Fetch Adapter for Server-Side Supabase Requests
 * Prevents Node.js TLS `ECONNRESET` / `fetch failed` errors on macOS/Cloudflare.
 */
export async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Se estiver rodando no navegador (client-side), usa obrigatoriamente o fetch nativo do browser
  if (typeof window !== "undefined") {
    return fetch(input, init);
  }

  // 1. Tentar fetch nativo do Node em primeira instância
  try {
    const response = await fetch(input, init);
    return response;
  } catch (error: any) {
    const isConnReset =
      error?.name === "TypeError" ||
      error?.message?.includes("fetch failed") ||
      error?.cause?.code === "ECONNRESET" ||
      error?.cause?.message?.includes("ECONNRESET");

    if (!isConnReset) {
      throw error;
    }

    // 2. Fallback resiliente via cURL (carregado estritamente em ambiente Node server-side)
    try {
      const nodeRequire = eval("require") as typeof require;
      const { execSync } = nodeRequire("child_process");

      const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
      const method = init?.method || "GET";
      const headers = init?.headers || {};
      const body = init?.body;

      let headerArgs = "";
      if (headers) {
        if (headers instanceof Headers) {
          headers.forEach((v, k) => {
            headerArgs += ` -H "${k}: ${v.replace(/"/g, '\\"')}"`;
          });
        } else if (Array.isArray(headers)) {
          headers.forEach(([k, v]) => {
            headerArgs += ` -H "${k}: ${v.replace(/"/g, '\\"')}"`;
          });
        } else {
          Object.entries(headers).forEach(([k, v]) => {
            headerArgs += ` -H "${k}: ${v.replace(/"/g, '\\"')}"`;
          });
        }
      }

      let bodyArg = "";
      if (body) {
        const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
        bodyArg = ` -d ${JSON.stringify(bodyStr)}`;
      }

      const cmd = `curl -s -i -X ${method}${headerArgs}${bodyArg} "${urlStr}"`;

      const output = execSync(cmd, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
      const headerEnd = output.indexOf("\r\n\r\n");
      const headerPart = headerEnd !== -1 ? output.substring(0, headerEnd) : output;
      const bodyPart = headerEnd !== -1 ? output.substring(headerEnd + 4) : "";

      const lines = headerPart.split("\r\n");
      const statusLine = lines[0] || "";
      const statusMatch = statusLine.match(/HTTP\/\d(?:\.\d)?\s+(\d+)/);
      const status = statusMatch ? parseInt(statusMatch[1], 10) : 200;

      const resHeaders = new Headers();
      lines.slice(1).forEach((l: string) => {
        const idx = l.indexOf(":");
        if (idx !== -1) {
          resHeaders.append(l.substring(0, idx).trim(), l.substring(idx + 1).trim());
        }
      });

      return new Response(bodyPart, {
        status,
        headers: resHeaders
      });
    } catch (curlErr) {
      throw error;
    }
  }
}
