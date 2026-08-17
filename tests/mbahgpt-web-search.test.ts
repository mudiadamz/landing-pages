import { describe, expect, it } from "vitest";
import { expandQuery, shouldSearch, stripWebPrefix } from "@/lib/mbahgpt/web-search";

/**
 * The search-query rules, pinned.
 *
 * These are the two decisions that spend money and decide whether an answer is
 * grounded in the right thing: WHEN to search, and WHAT to search for. Both are
 * lexical heuristics with no model behind them, which is exactly why they need
 * examples — a regression here is silent, and shows up as a plausible answer to
 * a question nobody asked.
 */

const UCL = "highlight ucl 2005";

describe("expandQuery — folding the earlier turn into a short follow-up", () => {
  it("anchors a follow-up that shares a topic word", () => {
    // The case the whole mechanism exists for: "final ucl" alone would find the
    // most recent final, not the 2005 one the conversation is about.
    const resolved = expandQuery("final ucl", [UCL]);
    expect(resolved).toBe("highlight 2005 final ucl");
  });

  it("anchors a follow-up that points back at something unnamed", () => {
    // No shared word at all — "golnya" is what ties it to the earlier turn.
    expect(expandQuery("siapa pencetak golnya?", [UCL])).toBe("highlight ucl 2005 siapa pencetak golnya?");
  });

  it("leaves a short question that names its own subject alone", () => {
    // The failure this gate was added for: a five-word question in a session
    // about something else used to be glued to the opening message, and the
    // search answered the opening message instead.
    const opener = "Halo. Jawab singkat saja: apa itu row level security di Postgres?";
    expect(expandQuery("siapa juara Liga Champions terbaru?", [opener])).toBe(
      "siapa juara Liga Champions terbaru?",
    );
  });

  it("leaves a message alone when there is no earlier turn", () => {
    expect(expandQuery("final ucl", [])).toBe("final ucl");
  });

  it("leaves a message long enough to stand on its own alone", () => {
    const long = "siapa yang mencetak gol di final liga champions 2005 itu";
    expect(expandQuery(long, [UCL])).toBe(long);
  });

  it("leaves a message that pins its own timeframe alone", () => {
    expect(expandQuery("final ucl 2013", [UCL])).toBe("final ucl 2013");
  });

  it("anchors a message that names no subject of its own, and only with the topic", () => {
    // "versi terbaru?" describes an attribute of whatever came before, so the
    // only subject available is the earlier one — and of that opener, everything
    // except "postgres" is greeting and question scaffolding.
    const opener = "Halo, tolong jelaskan singkat: apa itu Postgres?";
    expect(expandQuery("versi terbaru?", [opener])).toBe("postgres versi terbaru?");
  });

  it("anchors on the message that set the topic, not on every earlier turn", () => {
    // Accumulating each turn produced run-on queries that found nothing.
    const resolved = expandQuery("final ucl", [UCL, "siapa pencetak golnya", "berapa penontonnya"]);
    expect(resolved).toBe("highlight 2005 final ucl");
  });

  it("does not mistake ordinary -nya words for a back-reference", () => {
    // "hanya" ends in -nya and means nothing of the sort.
    expect(expandQuery("hanya cuaca Bandung?", ["apa itu row level security"])).toBe("hanya cuaca Bandung?");
  });

  it("collapses whitespace, as the query goes out as typed otherwise", () => {
    expect(expandQuery("  final   ucl  ", [UCL])).toBe("highlight 2005 final ucl");
  });
});

describe("shouldSearch — when a message needs live results", () => {
  it("catches an explicit request, in either language", () => {
    expect(shouldSearch("cari di internet harga emas")).toBe(true);
    expect(shouldSearch("search the web for this")).toBe(true);
  });

  it("catches recency words", () => {
    expect(shouldSearch("berita terbaru soal apa")).toBe(true);
    expect(shouldSearch("what is the latest release")).toBe(true);
  });

  it("catches a year the model cannot be trusted on", () => {
    expect(shouldSearch(`juara liga ${new Date().getFullYear()}`)).toBe(true);
  });

  it("leaves a timeless question alone", () => {
    expect(shouldSearch("apa itu row level security di Postgres?")).toBe(false);
    expect(shouldSearch("")).toBe(false);
  });

  it("follows a short message through, but only right after a search", () => {
    expect(shouldSearch("final ucl", true)).toBe(true);
    expect(shouldSearch("final ucl", false)).toBe(false);
    // Long enough to carry its own subject: not a follow-up. (Six words still
    // counts as one — the limit is what keeps unrelated questions out.)
    expect(shouldSearch("tulis satu fungsi python untuk sorting sebuah list", true)).toBe(false);
  });
});

describe("stripWebPrefix", () => {
  it("reports the prefix and removes it", () => {
    expect(stripWebPrefix("/web siapa juara")).toEqual({ text: "siapa juara", forced: true });
    expect(stripWebPrefix("/cari harga emas")).toEqual({ text: "harga emas", forced: true });
  });

  it("leaves an ordinary message untouched", () => {
    expect(stripWebPrefix("website apa yang bagus")).toEqual({
      text: "website apa yang bagus",
      forced: false,
    });
  });
});
