import { assertEquals } from "jsr:@std/assert@1";
import { registrationEventId } from "./tiktokEvents.ts";

Deno.test("registrationEventId usa o mesmo formato do pixel (cadastro_<user_id>)", () => {
  assertEquals(registrationEventId("8ab22fb6-3a8e-4093-8a61-e1777dbd0826"), "cadastro_8ab22fb6-3a8e-4093-8a61-e1777dbd0826");
});
