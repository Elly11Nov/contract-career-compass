import { describe, expect, test } from "bun:test";
import { buildQueries, DEFAULT_MAX_QUERIES, DEFAULT_RESULTS_PER_QUERY } from "../src/services/jobDiscovery.ts";
import { SEARCH_COUNTRIES } from "../src/services/searchCriteria.ts";

const day = new Date("2026-10-23T13:33:00Z");
const selected = (now) => buildQueries(now).slice(0, DEFAULT_MAX_QUERIES);
const isDocs = (q) => /"(Technical Writer|Lead Technical Writer|Documentation Specialist)"/.test(q.query);

describe("production discovery schedule (no network)", () => {
  test("retains 40 queries and five results per query", () => {
    expect(selected(day)).toHaveLength(40);
    expect(DEFAULT_RESULTS_PER_QUERY).toBe(5);
  });
  test("allocates 20 queries to each family", () => {
    expect(selected(day).filter(isDocs)).toHaveLength(20);
    expect(selected(day).filter((q) => !isDocs(q))).toHaveLength(20);
  });
  test("covers both families in each of all 13 countries", () => {
    expect(SEARCH_COUNTRIES).toHaveLength(13);
    for (const country of SEARCH_COUNTRIES) {
      const countryQueries = selected(day).filter((q) => q.country === country);
      expect(countryQueries.some(isDocs)).toBe(true);
      expect(countryQueries.some((q) => !isDocs(q))).toBe(true);
    }
  });
  test("rotates actual role/country/source selection, not just the after date", () => {
    const withoutDate = (now) => selected(now).map((q) => q.query.replace(/after:.*/, ""));
    expect(withoutDate(day)).not.toEqual(withoutDate(new Date("2026-10-24T13:33:00Z")));
    expect(selected(day)).toEqual(selected(new Date("2026-10-23T18:00:00Z")));
  });
  test("changes at Zurich midnight, even before UTC midnight", () => {
    expect(selected(new Date("2026-10-23T21:59:00Z"))[0].country)
      .not.toEqual(selected(new Date("2026-10-23T22:01:00Z"))[0].country);
  });
  test("each country reaches all five requested role titles over six days", () => {
    const required = ["Technical Writer", "Lead Technical Writer", "Documentation Specialist", "Requirements Engineer", "Business Analyst"];
    for (const country of SEARCH_COUNTRIES) {
      const queries = Array.from({ length: 6 }, (_, offset) => selected(new Date(day.getTime() + offset * 86_400_000)))
        .flat().filter((q) => q.country === country);
      for (const title of required) expect(queries.some((q) => q.query.includes(`"${title}"`))).toBe(true);
    }
  });
  test("does not discover permanent roles outside Switzerland and emits unique queries", () => {
    const queries = selected(day);
    expect(new Set(queries.map((q) => q.query)).size).toBe(40);
    expect(queries.filter((q) => q.country !== "Switzerland").every((q) => !q.query.includes("permanent"))).toBe(true);
  });
});