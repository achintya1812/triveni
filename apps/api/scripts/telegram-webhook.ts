import { telegram } from "../src/telegram";

// Tells Telegram where to send the bot's updates: <PUBLIC_API_URL>/telegram/webhook, with the secret the
// webhook checks. Run it again whenever PUBLIC_API_URL changes (a new tunnel, or the deployed API).

const url = process.env.PUBLIC_API_URL;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!url || !secret) throw new Error("Set PUBLIC_API_URL and TELEGRAM_WEBHOOK_SECRET in apps/api/.env");

await telegram("setWebhook", {
  url: `${url.replace(/\/$/, "")}/telegram/webhook`,
  secret_token: secret,
  allowed_updates: ["message", "callback_query"],
});
console.log(`Telegram now sends updates to ${url.replace(/\/$/, "")}/telegram/webhook`);
