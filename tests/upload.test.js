import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { binaryIds, parseRange, publicFile, streamParts } from "../lib/document-files.js";
import { formatSize, formatTime, inlineMime, previewKind, viewableFiles } from "../lib/files.js";
import { DEFAULT_MAX_UPLOAD_MB, PART_SIZE, maxUploadBytes, partCount, partId, partLength } from "../lib/upload-limits.js";
import { signUpload, verifyUpload } from "../lib/upload-token.js";

beforeAll(() => { process.env.APPWRITE_API_KEY = "clave-de-prueba"; });
afterEach(() => { delete process.env.UPLOAD_SECRET; });

describe("partes", () => {
  test("cuenta y longitud de cada parte, la última más corta", () => {
    const size = PART_SIZE * 2 + 10;
    expect(partCount(size)).toBe(3);
    expect([0, 1, 2].map((index) => partLength(size, index))).toEqual([PART_SIZE, PART_SIZE, 10]);
    expect(partCount(1)).toBe(1);
    expect(partLength(1, 0)).toBe(1);
    expect(partCount(PART_SIZE)).toBe(1);
    expect(partLength(PART_SIZE, 0)).toBe(PART_SIZE);
  });
  test("el id de una parte es válido para Appwrite (<= 36, sin símbolos) hasta en archivos enormes", () => {
    const id = partId("a".repeat(20), 9999);
    expect(id.length).toBeLessThanOrEqual(36);
    expect(id).toMatch(/^[A-Za-z0-9][A-Za-z0-9_]*$/);
  });
  test("el tope por archivo sale de MAX_UPLOAD_MB o vale 1 GB", () => {
    expect(maxUploadBytes({})).toBe(DEFAULT_MAX_UPLOAD_MB * 1024 * 1024);
    expect(maxUploadBytes({ MAX_UPLOAD_MB: "50" })).toBe(50 * 1024 * 1024);
    expect(maxUploadBytes({ MAX_UPLOAD_MB: "basura" })).toBe(DEFAULT_MAX_UPLOAD_MB * 1024 * 1024);
    expect(maxUploadBytes({ MAX_UPLOAD_MB: "-5" })).toBe(DEFAULT_MAX_UPLOAD_MB * 1024 * 1024);
  });
});

describe("binaryIds y publicFile", () => {
  test("un documento por partes lista sus partes; uno antiguo, su único binario", () => {
    expect(binaryIds({ partIds: ["p1", "p2"], storageFileId: "p1" })).toEqual(["p1", "p2"]);
    expect(binaryIds({ storageFileId: "bin" })).toEqual(["bin"]);
    expect(binaryIds({ partIds: [], storageFileId: "bin" })).toEqual(["bin"]);
    expect(binaryIds({})).toEqual([]);
  });
  test("lo que sale al cliente no incluye los ids internos de Storage", () => {
    const file = publicFile("f1", { $id: "d1", name: "a.mp4", size: 5, partIds: ["p"], storageFileId: "p" });
    expect(file).toEqual({ $id: "d1", name: "a.mp4", size: 5, downloadUrl: "/api/workspace/folders/f1/files/d1" });
  });
});

describe("parseRange", () => {
  test("sin cabecera no hay rango", () => expect(parseRange(null, 100)).toBeNull());
  test("tramo cerrado, abierto y sufijo", () => {
    expect(parseRange("bytes=0-9", 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
  });
  test("el final se recorta al tamaño y un sufijo mayor que el archivo es todo el archivo", () => {
    expect(parseRange("bytes=50-5000", 100)).toEqual({ start: 50, end: 99 });
    expect(parseRange("bytes=-5000", 100)).toEqual({ start: 0, end: 99 });
  });
  test.each(["bytes=", "bytes=-", "bytes=abc", "items=0-1", "bytes=100-", "bytes=50-10", "bytes=0-1,5-6"])("rechaza %s", (header) => expect(parseRange(header, 100)).toBe("invalid"));
});

describe("streamParts", () => {
  const bytes = (length) => Uint8Array.from({ length }, (_, index) => index % 251);
  const content = bytes(PART_SIZE * 2 + 100);
  const document = { partIds: ["a", "b", "c"] };
  const store = { a: content.subarray(0, PART_SIZE), b: content.subarray(PART_SIZE, PART_SIZE * 2), c: content.subarray(PART_SIZE * 2) };
  const read = async (id) => store[id];
  const collect = async (start, end) => Buffer.from(await new Response(streamParts(document, start, end, read)).arrayBuffer());

  test("todo el archivo se reconstruye igual", async () => expect((await collect(0, content.length - 1)).equals(Buffer.from(content))).toBe(true));
  test("un tramo dentro de una parte", async () => expect((await collect(10, 20)).equals(Buffer.from(content.subarray(10, 21)))).toBe(true));
  test("un tramo que cruza el límite entre dos partes", async () => {
    const start = PART_SIZE - 5;
    expect((await collect(start, start + 9)).equals(Buffer.from(content.subarray(start, start + 10)))).toBe(true);
  });
  test("un tramo que cruza tres partes", async () => {
    const start = PART_SIZE - 1;
    const end = PART_SIZE * 2 + 3;
    expect((await collect(start, end)).equals(Buffer.from(content.subarray(start, end + 1)))).toBe(true);
  });
  test("solo lee las partes necesarias", async () => {
    const reads = [];
    const tracked = async (id) => { reads.push(id); return store[id]; };
    await new Response(streamParts(document, PART_SIZE + 1, PART_SIZE + 5, tracked)).arrayBuffer();
    expect(reads).toEqual(["b"]);
  });
});

describe("token de subida", () => {
  const payload = { d: "doc1", f: "folder1", u: "user1", w: "ws1", n: "video.mp4", s: 123, t: "video/mp4" };

  test("firma y verifica", () => expect(verifyUpload(signUpload(payload))).toMatchObject(payload));
  test("caduca", () => {
    const token = signUpload(payload, { ttlMs: 1000, now: 1_000_000 });
    expect(verifyUpload(token, { now: 1_000_500 })).toMatchObject(payload);
    expect(verifyUpload(token, { now: 1_002_000 })).toBeNull();
  });
  test("manipular el contenido invalida la firma", () => {
    const [body, signature] = signUpload(payload).split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), u: "otro", s: 1 })).toString("base64url");
    expect(verifyUpload(`${forged}.${signature}`)).toBeNull();
  });
  test("una firma de otra clave no vale", () => {
    const token = signUpload(payload);
    process.env.UPLOAD_SECRET = "otra-clave-distinta";
    expect(verifyUpload(token)).toBeNull();
  });
  test.each([undefined, null, 5, "", "sin-punto", "a.b.c", `${"x".repeat(5000)}.y`])("rechaza basura: %p", (token) => expect(verifyUpload(token)).toBeNull());
});

describe("tipos que se ven en la página", () => {
  test("fotos, vídeo y audio se previsualizan; lo demás no", () => {
    expect(previewKind({ name: "a.jpg", mimeType: "image/jpeg" })).toBe("image");
    expect(previewKind({ name: "gol.mp4", mimeType: "video/mp4" })).toBe("video");
    expect(previewKind({ name: "voz.mp3", mimeType: "audio/mpeg" })).toBe("audio");
    expect(previewKind({ name: "informe.pdf", mimeType: "application/pdf" })).toBeNull();
    expect(previewKind({ name: "datos.csv", mimeType: "text/csv" })).toBeNull();
  });
  test("si el navegador no da tipo se usa la extensión", () => {
    expect(previewKind({ name: "partido.MOV", mimeType: "" })).toBe("video");
    expect(inlineMime({ name: "foto.jpeg", mimeType: "" })).toBe("image/jpeg");
    expect(inlineMime({ name: "clip.webm", mimeType: "application/octet-stream" })).toBe("video/webm");
  });
  test("nunca se muestran SVG ni HTML, ni aunque declaren ser una imagen", () => {
    expect(inlineMime({ name: "x.svg", mimeType: "image/svg+xml" })).toBeNull();
    expect(inlineMime({ name: "x.html", mimeType: "text/html" })).toBeNull();
    expect(inlineMime({ name: "x.html", mimeType: "" })).toBeNull();
    expect(previewKind({ name: "x.svg", mimeType: "image/svg+xml" })).toBeNull();
  });
  test("un nombre con la extensión de otro tipo no engaña: el tipo guardado en la lista manda", () => {
    expect(inlineMime({ name: "foto.html", mimeType: "image/png" })).toBe("image/png");
  });
});

describe("formatSize", () => {
  test("unidades legibles", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(1536)).toBe("1,5 KB");
    expect(formatSize(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatSize(3.2 * 1024 ** 3)).toBe("3,2 GB");
  });
  test("sin dato (archivos antiguos) no muestra nada", () => {
    expect(formatSize(undefined)).toBe("");
    expect(formatSize(null)).toBe("");
    expect(formatSize(-1)).toBe("");
  });
});

describe("tipos: nombres con claves del prototipo", () => {
  test.each(["x.constructor", "x.__proto__", "x.toString", "x.hasOwnProperty", "x.valueOf"])("%s no resuelve a nada del prototipo de Object", (name) => {
    expect(inlineMime({ name, mimeType: "" })).toBeNull();
    expect(previewKind({ name, mimeType: "" })).toBeNull();
  });
  test.each(["constructor", "__proto__", "toString"])("un tipo declarado %p tampoco cuela", (mimeType) => {
    expect(inlineMime({ name: "x.bin", mimeType })).toBeNull();
    expect(previewKind({ name: "x.bin", mimeType })).toBeNull();
  });
  test("un nombre sin extensión, vacío o ausente es null", () => {
    expect(inlineMime({ name: "README", mimeType: "" })).toBeNull();
    expect(inlineMime({ name: "", mimeType: "" })).toBeNull();
    expect(inlineMime({})).toBeNull();
    expect(inlineMime(undefined)).toBeNull();
  });
});

describe("viewableFiles", () => {
  const list = [
    { $id: "a", name: "foto.png", mimeType: "image/png" },
    { $id: "b", name: "informe.pdf", mimeType: "application/pdf" },
    { $id: "c", name: "gol.mp4", mimeType: "video/mp4" },
    { $id: "d", name: "x.svg", mimeType: "image/svg+xml" },
    { $id: "e", name: "voz.mp3", mimeType: "audio/mpeg" },
  ];
  test("deja solo foto, vídeo y audio, en el mismo orden", () => expect(viewableFiles(list).map((file) => file.$id)).toEqual(["a", "c", "e"]));
  test("sin lista no lanza", () => {
    expect(viewableFiles(undefined)).toEqual([]);
    expect(viewableFiles([])).toEqual([]);
  });
});

describe("formatTime", () => {
  test("minutos y segundos, y horas cuando hacen falta", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(65.9)).toBe("1:05");
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3723)).toBe("1:02:03");
  });
  test("valores que no son un tiempo válido (NaN antes de cargar, Infinity en directos, negativos) son 0:00", () => {
    for (const value of [NaN, Infinity, -3, undefined, null, "x"]) expect(formatTime(value)).toBe("0:00");
  });
});
