// Прокси заявок: принимает форму с сайта и пересылает в Telegram.
// Токен бота и chat_id лежат в секретах воркера (BOT_TOKEN, CHAT_ID), на сайте их нет.

const ALLOWED_ORIGIN = "https://emilgum-tech.github.io";
const METHODS = { telegram: "Telegram", phone: "Телефон", whatsapp: "WhatsApp" };

const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const reply = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const clean = (v, max) => String(v ?? "").trim().slice(0, max);

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return reply(405, { ok: false });
    if (request.headers.get("Origin") !== ALLOWED_ORIGIN) return reply(403, { ok: false });

    let data;
    try {
      data = await request.json();
    } catch {
      return reply(400, { ok: false, error: "bad json" });
    }

    if (data.website) return reply(200, { ok: true }); // honeypot: бот, молча игнорируем

    const name = clean(data.name, 100);
    const phone = clean(data.phone, 30);
    const method = METHODS[data.method] ? data.method : "telegram";
    const contact = clean(data.contact, 100);
    const message = clean(data.message, 2000);
    const email = clean(data.email, 200);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return reply(400, { ok: false, error: "Проверьте email" });
    }

    if (!name || !/^[\d\s+()\-]{7,}$/.test(phone)) {
      return reply(400, { ok: false, error: "Проверьте имя и телефон" });
    }
    if (method === "telegram" && !/^@?[A-Za-z0-9_]{5,32}$/.test(contact)) {
      return reply(400, { ok: false, error: "Укажите ник Telegram, например @username" });
    }

    const via =
      method === "telegram" ? (contact.startsWith("@") ? contact : "@" + contact)
      : method === "whatsapp" ? (contact || phone)
      : phone;

    const text = [
      "Новая заявка с сайта",
      `Имя: ${name}`,
      `Телефон: ${phone}`,
      `Связаться через: ${METHODS[method]} (${via})`,
      `Email: ${email || "—"}`,
      `Сообщение: ${message || "—"}`,
    ].join("\n");

    const tg = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.CHAT_ID, text }),
    });
    if (!tg.ok) return reply(502, { ok: false, error: "Не удалось отправить, напишите в Telegram" });
    return reply(200, { ok: true });
  },
};
