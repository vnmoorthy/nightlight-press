import { AUTHOR, FRONTDESK, MARKETER } from "./prompts.generated.js";
export { AUTHOR, FRONTDESK, MARKETER };
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
