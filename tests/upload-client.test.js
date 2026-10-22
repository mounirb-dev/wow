import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { uploadFile } from "../lib/upload-client.js";
import { PART_SIZE, partCount } from "../lib/upload-limits.js";

const MB = 1024 * 1024;
const BASE = "/api/workspace/folders/carpeta%201/files";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Bytes reconocibles: si el cliente corta o ordena mal las partes, el contenido reconstruido difiere.
function patterned(size) {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = (i * 31 + (i >> 8)) & 255;
  return bytes;
}

// Servidor falso en memoria que habla el protocolo de .../files y .../files/upload.
//   POST  {base}              -> {token, partSize, parts}   (abre la subida)
//   PUT   {base}/upload?part=N -> {ok}                      (guarda la parte N)
//   POST  {base}/upload        -> {file}                    (cierra)
//   DELETE {base}/upload                                    (cancela)
function createServer({ openStatus = 200, putHandler, keepBytes = true } = {}) {
  const state = { calls: [], puts: [], closes: [], cancels: [], parts: new Map(), inflight: 0, maxInflight: 0, token: "tok-123" };
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method || "GET";
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    state.calls.push({ url: String(url), method, headers, credentials: init.credentials });
    const [path, query = ""] = String(url).split("?");
    if (path === BASE && method === "POST") {
      if (openStatus !== 200) return json({ error: "El archivo supera el tope permitido" }, openStatus);
      const { size } = JSON.parse(init.body);
      state.opened = JSON.parse(init.body);
      return json({ token: state.token, partSize: PART_SIZE, parts: partCount(size) });
    }
    if (path === `${BASE}/upload` && method === "PUT") {
      const index = Number(new URLSearchParams(query).get("part"));
      const length = init.body.size;
      state.puts.push({ index, length, headers });
      state.inflight++;
      state.maxInflight = Math.max(state.maxInflight, state.inflight);
      try {
        const forced = putHandler ? await putHandler({ index, attempt: state.puts.filter((p) => p.index === index).length, state }) : null;
        if (forced) return forced;
        if (keepBytes) state.parts.set(index, new Uint8Array(await init.body.arrayBuffer()));
        return json({ ok: true });
      } finally {
        state.inflight--;
      }
    }
    if (path === `${BASE}/upload` && method === "POST") {
      state.closes.push(headers);
      return json({ file: { id: "doc-1", name: state.opened.name, size: state.opened.size } });
    }
    if (path === `${BASE}/upload` && method === "DELETE") {
      state.cancels.push(headers);
      return json({ ok: true });
    }
    return json({ error: "ruta inesperada" }, 404);
  };
  return state;
}

function joined(state, parts) {
  return Buffer.concat(Array.from({ length: parts }, (_, i) => state.parts.get(i)));
}

let realFetch;
beforeEach(() => { realFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = realFetch; });

describe("uploadFile: subida por partes", () => {
  test("un archivo de 9 MB sube 3 partes (4+4+1 MB), el servidor reconstruye lo mismo, cierra una vez y devuelve el documento", async () => {
    const server = createServer();
    const bytes = patterned(9 * MB);
    const file = new File([bytes], "partido.mp4", { type: "video/mp4" });
    const doc = await uploadFile("carpeta 1", file);
    const puts = [...server.puts].sort((a, b) => a.index - b.index);
    expect(puts.map((p) => p.length)).toEqual([4 * MB, 4 * MB, 1 * MB]);
    expect(joined(server, 3).equals(Buffer.from(bytes))).toBe(true);
    expect(server.opened).toEqual({ name: "partido.mp4", size: 9 * MB, type: "video/mp4" });
    expect(server.closes).toHaveLength(1);
    expect(server.cancels).toHaveLength(0);
    expect(doc).toEqual({ id: "doc-1", name: "partido.mp4", size: 9 * MB });
    // el cierre llega después de todas las partes
    const methods = server.calls.map((c) => c.method);
    expect(methods[0]).toBe("POST");
    expect(methods.lastIndexOf("PUT")).toBeLessThan(methods.length - 1);
    expect(methods.at(-1)).toBe("POST");
  });

  test("onProgress recibe bytes acumulados crecientes y termina en el tamaño total", async () => {
    createServer({ putHandler: async ({ index }) => { await wait(index * 15); return null; } });
    const size = 9 * MB;
    const seen = [];
    await uploadFile("carpeta 1", new File([patterned(size)], "a.bin"), (sent) => seen.push(sent));
    expect(seen).toHaveLength(3);
    expect(seen.every((value, i) => i === 0 || value > seen[i - 1])).toBe(true);
    expect(seen.at(-1)).toBe(size);
  });

  test("un archivo de 1 byte es una sola parte de 1 byte", async () => {
    const server = createServer();
    const seen = [];
    await uploadFile("carpeta 1", new File([new Uint8Array([7])], "n.txt", { type: "text/plain" }), (sent) => seen.push(sent));
    expect(server.puts.map((p) => [p.index, p.length])).toEqual([[0, 1]]);
    expect(Array.from(server.parts.get(0))).toEqual([7]);
    expect(seen).toEqual([1]);
    expect(server.closes).toHaveLength(1);
  });

  test("nunca hay más de 3 partes en vuelo a la vez (y se llega a 3)", async () => {
    const server = createServer({ keepBytes: false, putHandler: async () => { await wait(10); return null; } });
    await uploadFile("carpeta 1", new File([new Uint8Array(9 * PART_SIZE)], "grande.bin"));
    expect(server.puts).toHaveLength(9);
    expect(server.maxInflight).toBe(3);
  });

  test("las cabeceras: apertura JSON, partes con token y octet-stream, y cookies incluidas", async () => {
    const server = createServer();
    await uploadFile("carpeta 1", new File([patterned(5 * MB)], "x.bin"));
    const open = server.calls[0];
    expect(open.headers["content-type"]).toBe("application/json");
    expect(open.credentials).toBe("include");
    const puts = server.calls.filter((c) => c.method === "PUT");
    expect(puts).toHaveLength(2);
    for (const put of puts) {
      expect(put.headers["x-upload-token"]).toBe(server.token);
      expect(put.headers["content-type"]).toBe("application/octet-stream");
      expect(put.credentials).toBe("include");
    }
    expect(server.closes[0]["x-upload-token"]).toBe(server.token);
  });
});

describe("uploadFile: fallos", () => {
  test("una parte que falla una vez con 500 se reintenta y la subida termina bien", async () => {
    const server = createServer({ putHandler: async ({ index, attempt }) => (index === 0 && attempt === 1 ? json({ error: "Fallo transitorio" }, 500) : null) });
    const bytes = patterned(5 * MB);
    const doc = await uploadFile("carpeta 1", new File([bytes], "r.bin"));
    expect(server.puts.filter((p) => p.index === 0)).toHaveLength(2);
    expect(joined(server, 2).equals(Buffer.from(bytes))).toBe(true);
    expect(server.closes).toHaveLength(1);
    expect(server.cancels).toHaveLength(0);
    expect(doc.id).toBe("doc-1");
  });

  test("una parte que falla siempre rechaza con el mensaje del servidor, no cierra y cancela con el mismo token", async () => {
    const server = createServer({ putHandler: async () => json({ error: "Almacenamiento lleno" }, 500) });
    await expect(uploadFile("carpeta 1", new File([new Uint8Array([1])], "f.bin"))).rejects.toThrow("Almacenamiento lleno");
    expect(server.puts).toHaveLength(3); // 3 intentos
    expect(server.closes).toHaveLength(0);
    expect(server.cancels).toHaveLength(1);
    expect(server.cancels[0]["x-upload-token"]).toBe(server.token);
    expect(server.calls.filter((c) => c.method === "DELETE")[0].credentials).toBe("include");
  });

  test("si falla la apertura (413) rechaza con ese mensaje, sin subir nada ni cancelar", async () => {
    const server = createServer({ openStatus: 413 });
    await expect(uploadFile("carpeta 1", new File([new Uint8Array(5 * MB)], "enorme.bin"))).rejects.toThrow("El archivo supera el tope permitido");
    expect(server.calls).toHaveLength(1);
    expect(server.puts).toHaveLength(0);
    expect(server.cancels).toHaveLength(0);
  });

  test("tras el fallo de una parte, las pendientes dejan de enviarse", async () => {
    const parts = 20;
    const server = createServer({
      keepBytes: false,
      putHandler: async ({ index }) => {
        if (index === 1) return json({ error: "Parte rota" }, 500);
        await wait(300);
        return null;
      },
    });
    await expect(uploadFile("carpeta 1", new File([new Uint8Array(parts * PART_SIZE)], "v.bin"))).rejects.toThrow("Parte rota");
    await wait(700); // deja terminar las que ya estaban en vuelo
    const sentAfter = server.puts.length;
    await wait(400);
    expect(server.puts.length).toBe(sentAfter); // nada nuevo sale después del fallo
    expect(server.puts.length).toBeLessThan(parts);
    expect(server.closes).toHaveLength(0);
    expect(server.cancels).toHaveLength(1);
  }, 15000);
});

describe("uploadFile: fallos y cancelación", () => {
  test("un error 4xx (permiso, tamaño, token caducado) no se reintenta: falla a la primera y cancela", async () => {
    const server = createServer({ putHandler: async () => json({ error: "La subida no es válida o ha caducado" }, 400) });
    await expect(uploadFile("carpeta 1", new File([patterned(MB)], "a.bin"))).rejects.toMatchObject({ message: "La subida no es válida o ha caducado", status: 400 });
    expect(server.puts).toHaveLength(1);
    expect(server.closes).toHaveLength(0);
    expect(server.cancels).toHaveLength(1);
  });

  test("un 5xx sí se reintenta hasta 3 veces", async () => {
    const server = createServer({ putHandler: async () => json({ error: "caído" }, 503) });
    await expect(uploadFile("carpeta 1", new File([patterned(MB)], "a.bin"))).rejects.toMatchObject({ message: "caído", status: 503 });
    expect(server.puts).toHaveLength(3);
  }, 10000);

  test("al fallar una parte espera a las que iban en vuelo ANTES de cancelar, para que no se escriban después", async () => {
    let lateWrite = false;
    const server = createServer({
      putHandler: async ({ index }) => {
        if (index === 0) return json({ error: "sin permiso" }, 403);
        await wait(80);
        lateWrite = true;
        return null;
      },
    });
    await expect(uploadFile("carpeta 1", new File([patterned(9 * MB)], "a.bin"))).rejects.toMatchObject({ status: 403 });
    // Las partes 1 y 2 estaban en vuelo cuando falló la 0: terminaron (lateWrite) y solo entonces salió el DELETE.
    expect(lateWrite).toBe(true);
    expect(server.cancels).toHaveLength(1);
    expect(server.inflight).toBe(0);
    const order = server.calls.map((call) => call.method);
    expect(order.at(-1)).toBe("DELETE");
  });

  test("un fallo al cancelar no tapa el error original", async () => {
    const server = createServer({ putHandler: async () => json({ error: "sin permiso" }, 403) });
    const original = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
      if ((init.method || "GET") === "DELETE") throw new Error("sin red");
      return original(url, init);
    };
    await expect(uploadFile("carpeta 1", new File([patterned(MB)], "a.bin"))).rejects.toMatchObject({ message: "sin permiso" });
    expect(server.puts).toHaveLength(1);
  });
});

describe("request (api-client)", () => {
  test("una respuesta 204 sin cuerpo devuelve null en vez de lanzar", async () => {
    const { request } = await import("../lib/api-client.js");
    globalThis.fetch = async () => new Response(null, { status: 204 });
    expect(await request("/x", { method: "DELETE" })).toBeNull();
  });

  test("un error lleva el mensaje del servidor y su código HTTP", async () => {
    const { request } = await import("../lib/api-client.js");
    globalThis.fetch = async () => json({ error: "No autorizado" }, 401);
    await expect(request("/x")).rejects.toMatchObject({ message: "No autorizado", status: 401 });
  });

  test("un error sin cuerpo JSON usa un mensaje genérico", async () => {
    const { request } = await import("../lib/api-client.js");
    globalThis.fetch = async () => new Response("<html>", { status: 502 });
    await expect(request("/x")).rejects.toMatchObject({ message: "No se pudo completar la acción", status: 502 });
  });
});
