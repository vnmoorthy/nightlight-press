import { AUTHOR, FRONTDESK, MARKETER, TELLER } from "./prompts.generated.js";
export { AUTHOR, FRONTDESK, MARKETER, TELLER };
// Pip: an opt-in, disclosed robot sidekick. Families choose it; the book credits it; stories never sell.
export const ROBOT_LOOK = "a small round toy robot with a glossy sky-blue body, a round white head with two friendly oval eyes, a short antenna topped with a glowing yellow star, and two little wheels";
export const ROBOT_STORY = "Include Pip, a small, friendly PlayRobot toy robot, as the hero's sidekick on most pages. Pip looks the same on every page: " + ROBOT_LOOK + ". Pip is kind and helpful and joins the adventure. Never mention buying, shops, prices or toys for sale.";
export function fill(t, vars) { return t.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? "")); }
export const LANG = { en: "English", es: "Spanish", hi: "Hindi", ta: "Tamil", te: "Telugu", bn: "Bengali", fr: "French", de: "German", pt: "Portuguese", it: "Italian", zh: "Mandarin Chinese", ko: "Korean", ja: "Japanese", tl: "Tagalog", vi: "Vietnamese", ar: "Arabic" };
export const STYLES = {
  watercolor: "Soft watercolour and gouache picture-book illustration, gentle textured paper, warm muted palette, loose brushwork",
  storybook: "Classic storybook illustration, rich warm colours, soft lighting, cosy detailed backgrounds, timeless picture-book feel",
  papercut: "Layered cut-paper collage illustration, bold simple shapes, visible paper textures, playful bright palette",
  pencil: "Coloured-pencil and crayon picture-book illustration, hand-drawn lines, light cheerful palette, lots of white space",
  night: "Dreamy night-time picture-book illustration, deep blues and golden lamplight, glowing stars, soft and calm",
};
export const SCHEMAS = {
  story: { type: "object", additionalProperties: false, required: ["title", "dedication", "hero_look", "blurb", "pages"], properties: { title: { type: "string" }, dedication: { type: "string" }, hero_look: { type: "string" }, blurb: { type: "string" }, pages: { type: "array", minItems: 6, maxItems: 14, items: { type: "object", additionalProperties: false, required: ["text", "scene"], properties: { text: { type: "string" }, scene: { type: "string" } } } } } },
  frontdesk: { type: "object", additionalProperties: false, required: ["intent", "pages", "instructions", "reply", "escalate"], properties: { intent: { type: "string", enum: ["revise_text", "revise_art", "revise_both", "question", "thanks", "refund", "other"] }, pages: { type: "array", items: { type: "integer" } }, instructions: { type: "string" }, reply: { type: "string" }, escalate: { type: "boolean" } } },
  marketer: { type: "object", additionalProperties: false, required: ["hero_name", "look", "age", "pronoun", "favorites", "occasion", "style", "caption"], properties: { hero_name: { type: "string" }, look: { type: "string" }, age: { type: "integer" }, pronoun: { type: "string", enum: ["he", "she", "they"] }, favorites: { type: "string" }, occasion: { type: "string" }, style: { type: "string", enum: ["watercolor", "storybook", "papercut", "pencil", "night"] }, caption: { type: "string" } } },
};
