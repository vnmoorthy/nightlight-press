/** The Editor's desk: deterministic checks every story must pass before a single picture is painted. */
const BANNED = ["kill", "killed", "blood", "dead", "die", "dies", "died", "gun", "knife", "weapon", "hate", "stupid", "idiot", "ugly", "shut up", "fat", "dumb", "beer", "wine", "cigarette", "drunk", "demon", "devil", "hell", "sexy", "kiss me"];
const BRANDS = ["disney", "pixar", "marvel", "spider-man", "spiderman", "batman", "superman", "elsa", "frozen", "pokemon", "pokémon", "pikachu", "barbie", "lego", "minecraft", "fortnite", "paw patrol", "peppa", "bluey", "mickey", "minnie", "sonic", "mario", "star wars", "harry potter", "hot wheels", "youtube", "tiktok", "roblox"];
const syllables = (w) => { w = w.toLowerCase().replace(/[^a-z]/g, ""); if (!w) return 0; if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, ""); const m = w.match(/[aeiouy]{1,2}/g); return m ? m.length : 1; };
export function maxWordsFor(age) { return age <= 3 ? 25 : age <= 5 ? 35 : age <= 7 ? 45 : 60; }
export function checkStory(story, { name, age, language = "en" }) {
  const pages = story.pages || []; const max = maxWordsFor(age || 5); const issues = [];
  if (pages.length < 6) issues.push(`only ${pages.length} pages`);
  const words = pages.map((p) => String(p.text || "").split(/\s+/).filter(Boolean).length);
  words.forEach((n, i) => { if (n > max + 8) issues.push(`page ${i + 1} has ${n} words (limit ${max})`); });
  const all = [story.title, story.dedication, story.blurb, ...pages.map((p) => `${p.text} ${p.scene}`)].join(" \n ").toLowerCase();
  const nameHits = pages.filter((p) => String(p.text).toLowerCase().includes(String(name).toLowerCase().split(" ")[0])).length;
  if (nameHits < Math.ceil(pages.length * 0.5)) issues.push(`the hero's name appears on only ${nameHits} of ${pages.length} pages`);
  const banned = BANNED.filter((b) => new RegExp(`\\b${b}\\b`, "i").test(all)); if (banned.length) issues.push(`unsuitable words: ${banned.join(", ")}`);
  const brands = BRANDS.filter((b) => all.includes(b)); if (brands.length) issues.push(`trademarked names: ${brands.join(", ")}`);
  if (/https?:\/\//i.test(all)) issues.push("a web address");
  let grade = null;
  if (language === "en") { const text = pages.map((p) => p.text).join(" "); const sents = Math.max(1, (text.match(/[.!?]+/g) || []).length); const ws = text.split(/\s+/).filter(Boolean); const syl = ws.reduce((a, w) => a + syllables(w), 0); grade = Math.round((0.39 * (ws.length / sents) + 11.8 * (syl / Math.max(1, ws.length)) - 15.59) * 10) / 10; }
  return { pass: issues.length === 0, issues, pages: pages.length, words: words.reduce((a, b) => a + b, 0), max_words: max, name_pages: nameHits, reading_grade: grade };
}
