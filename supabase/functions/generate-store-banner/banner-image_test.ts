import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { bannerDimensions, bearerToken, decodeBanner } from "./banner-image.ts";

Deno.test("generation requires a Bearer session, not a missing or malformed header", () => {
  assertEquals(bearerToken(null), null);
  assertEquals(bearerToken("Basic abc"), null);
  assertEquals(bearerToken("Bearer"), null);
  assertEquals(bearerToken("Bearer session-token"), "session-token");
});

Deno.test("PNG header preserves 4K 16:9 dimensions without resizing", () => {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 4096);
  view.setUint32(20, 2304);
  assertEquals(bannerDimensions(bytes), { width: 4096, height: 2304 });
});

Deno.test("JPEG header reads width and height", () => {
  const bytes = new Uint8Array([255, 216, 255, 192, 0, 11, 8, 9, 0, 16, 0, 1, 1, 17, 0]);
  assertEquals(bannerDimensions(bytes), { width: 4096, height: 2304 });
  assertEquals(bannerDimensions(bytes.slice(0, 8)), null);
});

Deno.test("storage preserves PNG/JPEG bytes and the matching extension", () => {
  const png = decodeBanner("data:image/png;base64,AQID");
  assertEquals([...png.bytes], [1, 2, 3]);
  assertEquals(png.extension, "png");
  assertEquals(decodeBanner("data:image/jpeg;base64,AQID").extension, "jpg");
  assertThrows(() => decodeBanner("data:text/html;base64,AQID"));
});

Deno.test("large banner decoding crosses chunk boundaries without copying into a JS array", () => {
  const base64 = "AQID".repeat(4 * 1024 * 1024) + "BA==";
  const decoded = decodeBanner(`data:image/png;base64,${base64}`);
  assertEquals(decoded.bytes.length, 12 * 1024 * 1024 + 1);
  assertEquals([...decoded.bytes.slice(32766, 32772)], [1, 2, 3, 1, 2, 3]);
  assertEquals(decoded.bytes[decoded.bytes.length - 1], 4);
});