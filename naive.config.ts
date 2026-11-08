import { defineProject } from "@usenaive-sdk/blueprints";

// NIGHTLIGHT PRESS: a US children's publisher with no employees.
// Agents write, read and talk; deterministic code decides when, whether and how much.
const budget = (capUsd: number, taskUsd: number) => ({ cap_micro_usd: Math.round(capUsd * 1e6), max_task_micro_usd: Math.round(taskUsd * 1e6), period: "day" as const });
const MODEL = process.env.NL_MODEL || "openai/gpt-6-luna";
const WITH_APPS = process.env.NL_WITH_APPS === "1"; // agents first, then the hosted app once its env exists

export default defineProject({
  name: "nightlight",
  title: "Nightlight Press",
  description: "A bedtime picture book starring your child: written, illustrated, narrated and bound in minutes by a publisher whose whole staff is AI agents.",
  identities: [{ name: "Nightlight Press", description: "The publisher's public persona: the name on every email, the Storyteller Line's voice." }],
  vaults: [
    {
      name: "nightlight-sponsors",
      identity: "Nightlight Press",
      credentials: [
        { kind: "static_bearer", key: "AGENTMAIL", mcp_server_url: "https://mcp.agentmail.to/mcp", value: { from_env: "AGENTMAIL_API_KEY" } },
        { kind: "static_bearer", key: "MONID", mcp_server_url: "https://mcp.monid.ai/v1", value: { from_env: "MONID_API_KEY" } },
        { kind: "static_bearer", key: "MOBILERUN", mcp_server_url: "https://api.mobilerun.ai/v1/mcp", value: { from_env: "MOBILERUN_API_KEY" } },
      ],
    },
  ],
  agents: [
    ...(!WITH_APPS ? [] : [{
      name: "night-manager",
      model: process.env.NL_CLOCK_MODEL || "z-ai/glm-5.3-flash",
      budget: budget(2, 0.05),
      description: "The Night Manager. Every five minutes it wakes the office through the app's MCP tick tool, so queued books keep moving and the nightly shelf book gets commissioned. It decides nothing.",
      role: "clock",
      system: "You are the Night Manager of Nightlight Press. When woken, call the tool nightlight-press.tick exactly once, then call nightlight-press.board_summary once, and reply with one line summarising both results. Do nothing else.",
      allowed_apps: ["nightlight-press"],
      tools: { default_config: { permission: "deny" }, configs: { "nightlight-press.tick": { enabled: true, permission: "allow" }, "nightlight-press.board_summary": { enabled: true, permission: "allow" } } },
      window: "immediate",
      schedules: [{ cron: "*/5 * * * *", timezone: "America/Los_Angeles", input: "Wake the office.", summary: "Night Manager rounds", budget_micro_usd: 50000 }],
    }]),
    {
      name: "author",
      model: MODEL,
      allowed_apps: [],
      budget: budget(25, 1),
      description: "The Author. Writes one new picture book per order, in the child's language and at their reading level, and revises it when a family asks.",
      role: "writer",
      system: "You are the Author at Nightlight Press, a children's picture-book publisher. You write gentle, funny, warm stories for one specific child. You only ever return JSON matching the schema in the message. The Editor is a program that counts your words and checks names; obey its limits exactly.",
      tools: { default_config: { permission: "deny" }, configs: {} },
      window: "immediate",
    },
    {
      name: "frontdesk",
      model: MODEL,
      allowed_apps: [],
      budget: budget(10, 0.4),
      description: "The Front Desk. Reads every reply from families, answers in plain warm English, routes change requests back to production, and escalates refunds or anything worrying to a person.",
      role: "support",
      system: "You are the Front Desk at Nightlight Press. Families write to you about books made for their children. Reply briefly and warmly, never promise what code has not done, and return JSON matching the schema in the message.",
      tools: { default_config: { permission: "deny" }, configs: {} },
      window: "immediate",
    },
    {
      name: "marketer",
      model: MODEL,
      allowed_apps: [],
      budget: budget(5, 0.3),
      description: "Marketing. Commissions one new free picture book for the public shelf every night, writes its caption, and announces it to subscribers and on social.",
      role: "marketing",
      system: "You are Marketing at Nightlight Press. Each night you choose one new free shelf book that will make parents want a book starring their own child. Vary heroes, cultures, occasions and styles. Return JSON matching the schema in the message.",
      tools: { default_config: { permission: "deny" }, configs: {} },
      window: "immediate",
      schedules: [{ cron: "0 18 * * *", timezone: "America/Los_Angeles", input: "Evening check: in one line, name the kind of shelf book parents most need tonight (an occasion and an age).", summary: "Evening shelf idea", budget_micro_usd: 50000 }],
    },
  ],
  apps: !WITH_APPS ? [] : [
    {
      name: "nightlight-press",
      type: "fullstack",
      description: "The publisher: the shop, Stripe checkout, the production line (job queue), the reader, the office floor, the public board, a hash-chained ledger, and an MCP endpoint for the Night Manager.",
      deploy_dir: "./app/dist",
      mcp: "/mcp",
      required: true,
      migrations: ["./app/migrations/001_init.sql", "./app/migrations/002_told.sql"],
      env: {
        COMPANY_NAIVE_KEY: { from_env: "NL_COMPANY_KEY" },
        MONID_API_KEY: { from_env: "MONID_API_KEY" },
        AGENTMAIL_API_KEY: { from_env: "AGENTMAIL_API_KEY" },
        MOBILERUN_API_KEY: { from_env: "MOBILERUN_API_KEY" },
        MOBILERUN_DEVICE_ID: { from_env: "MOBILERUN_DEVICE_ID" },
        STRIPE_SECRET_KEY: { from_env: "NL_STRIPE_KEY" },
        OPENAI_API_KEY: { from_env: "OPENAI_API_KEY" },
        MONID_VOICE_PROVIDER: { from_env: "MONID_VOICE_PROVIDER" },
        MONID_NUMBER_ID: { from_env: "MONID_NUMBER_ID" },
        MONID_FROM_E164: { from_env: "MONID_FROM_E164" },
        AGENTMAIL_INBOX_ID: { from_env: "AGENTMAIL_INBOX_ID" },
        NAIVE_AGENT_AUTHOR: { from_env: "NAIVE_AGENT_AUTHOR" },
        NAIVE_AGENT_FRONTDESK: { from_env: "NAIVE_AGENT_FRONTDESK" },
        NAIVE_AGENT_MARKETER: { from_env: "NAIVE_AGENT_MARKETER" },
        PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || "http://localhost:3100",
        AGENTMAIL_WEBHOOK_SECRET: { from_env: "NL_AM_WHSEC" },
        NAIVE_WEBHOOK_SECRET: { from_env: "NL_NAIVE_WHSEC" },
        ADMIN_TOKEN: { from_env: "NL_ADMIN_TOKEN" },
        NARRATOR_VOICE: "sage",
        SHELF_EVERY_HOURS: "12",
        BOOK_PAGES: "10",
      },
    },
  ],
  // No board tasks: every piece of production is a job in the app's queue, and agents never edit or deploy the app.
});
