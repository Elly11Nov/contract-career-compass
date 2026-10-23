import { expect, test } from "bun:test";
import { isSameVacancy, normalizeVacancyUrl } from "../src/services/jobIdentity.ts";

const vacancy = { company: "SIX", title: "Senior Requirements Engineer (80-100%)", city: "Zurich", country: "Switzerland", contract_type: "Permanent", url: "https://jobs.ch/vacancies/first" };

test("recognises SIX versus SIX Group AG on different sites", () => {
  expect(isSameVacancy(vacancy, { ...vacancy, company: "SIX Group AG", url: "https://ch.trabajo.org/job/second" })).toBe(true);
});
test("does not merge different locations, titles, contracts or companies", () => {
  for (const patch of [{ city: "Zug" }, { title: "Technical Writer" }, { contract_type: "Contract" }, { company: "SIX Consulting" }]) {
    expect(isSameVacancy(vacancy, { ...vacancy, ...patch, url: "https://other.ch/job/different" })).toBe(false);
  }
});
test("tracking variations identify the same URL", () => {
  expect(normalizeVacancyUrl("https://www.coopers.ch/de/detail.php?refCode=RU0R87&utm_source=test"))
    .toBe(normalizeVacancyUrl("https://coopers.ch/de/detail.php?refCode=RU0R87"));
});
test("distinct requisition IDs survive identical title/company/location", () => {
  const a = { ...vacancy, url: "https://coopers.ch/de/detail.php?refCode=RU0R87" };
  const b = { ...vacancy, url: "https://coopers.ch/de/detail.php?refCode=NEW123" };
  expect(normalizeVacancyUrl(a.url)).not.toBe(normalizeVacancyUrl(b.url));
  expect(isSameVacancy(a, b)).toBe(false);
});