// Unit tests for "Add to calendar" (pure, no network).
//   node --test tests/ics.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildIcs,
  calendarWindow,
  escapeIcsText,
  foldIcsLine,
  googleCalendarUrl,
  icsFileName,
  icsUid,
  icsUtc,
} from "../src/lib/ics.ts";

const octets = (s) => Buffer.byteLength(s, "utf8");
const unfold = (s) => s.replace(/\r\n[ \t]/g, "");

const EV = {
  id: "2b9c7c1e-0f5e-4d8a-9a51-3c1d2e4f5a6b",
  title: "Kadıköy jazz night",
  startsAt: "2026-10-31T19:30:00+03:00",
  endsAt: "2026-10-31T22:00:00+03:00",
  location: "Moda Sahnesi, Kadıköy",
  description: "Bring a friend; doors open at 19:00.",
};
const NOW = new Date("2026-10-30T21:00:00Z");

test("UTC basic format converts Istanbul time to Z", () => {
  assert.equal(icsUtc(new Date("2026-10-31T19:30:00+03:00")), "20261031T163000Z");
  assert.equal(icsUtc(new Date("2026-01-01T00:00:00.123Z")), "20260101T000000Z");
  assert.throws(() => icsUtc(new Date("not a date")), RangeError);
});

test("TEXT escaping: backslash, semicolon, comma, line breaks; colon untouched", () => {
  assert.equal(escapeIcsText("a\\b"), "a\\\\b");
  assert.equal(escapeIcsText("a;b,c"), "a\\;b\\,c");
  assert.equal(escapeIcsText("one\ntwo\r\nthree\rfour"), "one\\ntwo\\nthree\\nfour");
  assert.equal(escapeIcsText("time: 19:30"), "time: 19:30");
  assert.equal(escapeIcsText("bell\u0007tab\tok"), "belltab\tok");
  assert.equal(escapeIcsText(null), "");
  // the backslash is escaped first, so an escaped comma is not double-escaped
  assert.equal(escapeIcsText("\\,"), "\\\\\\,");
});

test("folding: lines ≤ 75 octets, continuation starts with a space, unfolds to the original", () => {
  const long = "DESCRIPTION:" + "x".repeat(200);
  const folded = foldIcsLine(long);
  const lines = folded.split("\r\n");
  assert.ok(lines.length > 1);
  for (const l of lines) assert.ok(octets(l) <= 75, `line has ${octets(l)} octets`);
  for (const l of lines.slice(1)) assert.equal(l[0], " ");
  assert.equal(unfold(folded), long);
  // short lines stay as they are
  assert.equal(foldIcsLine("SUMMARY:short"), "SUMMARY:short");
  assert.equal(octets(foldIcsLine("A".repeat(75))), 75);
  assert.equal(foldIcsLine("A".repeat(76)).split("\r\n").length, 2);
});

test("folding never splits a multi-byte character (Turkish letters, emoji)", () => {
  const line = "SUMMARY:" + "ığüşöçİ".repeat(20) + "🎷".repeat(10);
  const folded = foldIcsLine(line);
  for (const l of folded.split("\r\n")) {
    assert.ok(octets(l) <= 75, `line has ${octets(l)} octets`);
    assert.ok(!l.includes("�"));
  }
  assert.equal(unfold(folded), line);
  // every piece is valid UTF-8 on its own: re-encoding round-trips
  for (const l of folded.split("\r\n")) assert.equal(Buffer.from(l, "utf8").toString("utf8"), l);
});

test("a full event: CRLF, UTC times, DTSTAMP, UID from the id, escaped text", () => {
  const ics = buildIcs(EV, { now: NOW });
  assert.ok(ics.endsWith("\r\n"));
  assert.ok(!/[^\r]\n/.test(ics), "every line break is CRLF");
  const lines = unfold(ics).split("\r\n");
  assert.equal(lines[0], "BEGIN:VCALENDAR");
  assert.ok(lines.includes("VERSION:2.0"));
  assert.ok(lines.includes("BEGIN:VEVENT"));
  assert.ok(lines.includes(`UID:${icsUid(EV.id)}`));
  assert.ok(icsUid(EV.id).startsWith(`event-${EV.id}@`));
  assert.ok(lines.includes("DTSTAMP:20261030T210000Z"));
  assert.ok(lines.includes("DTSTART:20261031T163000Z"));
  assert.ok(lines.includes("DTEND:20261031T190000Z"));
  assert.ok(lines.includes("SUMMARY:Kadıköy jazz night"));
  assert.ok(lines.includes("LOCATION:Moda Sahnesi\\, Kadıköy"));
  const desc = lines.find((l) => l.startsWith("DESCRIPTION:"));
  assert.equal(desc, "DESCRIPTION:Bring a friend\\; doors open at 19:00.");
  for (const l of ics.split("\r\n")) assert.ok(octets(l) <= 75);
});

test("no end time: 2-hour default only in the export, and the description says so", () => {
  const ev = { ...EV, endsAt: null };
  const w = calendarWindow(ev);
  assert.equal(w.endEstimated, true);
  assert.equal(w.end.getTime() - w.start.getTime(), 2 * 3600e3);
  const note = "Bitiş saati belirtilmedi; 2 saatlik süre tahminidir.";
  const ics = unfold(buildIcs(ev, { now: NOW, noEndNote: note }));
  assert.ok(ics.includes("DTEND:20261031T183000Z"));
  assert.ok(ics.includes(escapeIcsText(note)));
  // an end before the start is not trusted either
  assert.equal(calendarWindow({ ...EV, endsAt: "2026-10-31T18:00:00+03:00" }).endEstimated, true);
  // with a real end there is no estimate note
  assert.equal(calendarWindow(EV).endEstimated, false);
  assert.ok(!unfold(buildIcs(EV, { now: NOW, noEndNote: note })).includes("tahmin"));
});

test("Google Calendar link carries the same UTC window and the time zone", () => {
  const url = new URL(googleCalendarUrl({ ...EV, endsAt: null }, { noEndNote: "estimated end" }));
  assert.equal(url.origin + url.pathname, "https://calendar.google.com/calendar/render");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(url.searchParams.get("text"), EV.title);
  assert.equal(url.searchParams.get("dates"), "20261031T163000Z/20261031T183000Z");
  assert.equal(url.searchParams.get("ctz"), "Europe/Istanbul");
  assert.match(url.searchParams.get("details"), /estimated end/);
  assert.equal(url.searchParams.get("location"), EV.location);
});

test("file name is a short ASCII slug", () => {
  assert.equal(icsFileName("Kadıköy Jazz Night!"), "agora-kadikoy-jazz-night.ics");
  assert.equal(icsFileName("İstanbul’da Şiir"), "agora-istanbul-da-siir.ics");
  assert.equal(icsFileName("   "), "agora-event.ics");
  assert.ok(icsFileName("a".repeat(100)).length <= "agora-.ics".length + 40);
});
