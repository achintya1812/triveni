import { concepts, kits } from "@triveni/content";
import { Child, type ParentMessage, ParentReply } from "@triveni/core";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { camel, json, run, snake } from "../http";
import { transcribe } from "../saaras";
import { publicUrl, telegram, telegramFile, voiceNote } from "../telegram";

// Parents on Telegram: voice notes in the child's home language, and what parents send back.

const Send = z.object({ kind: z.enum(["catch_up", "activity"]), conceptId: z.string(), childIds: z.array(z.uuid()).min(1) });

// The teacher's reply: a text, or a voice note recorded in the app. Telegram plays only OGG/Opus, MP3 and M4A
// as voice messages, and the API has no ffmpeg, so the app records one of these.
const voiceTypes = { "audio/ogg": "ogg", "audio/mp4": "m4a" } as const;
const Reply = z.union([
  z.object({ childId: z.uuid(), text: z.string().trim().min(1).max(4000) }),
  z.object({ childId: z.uuid(), audio: z.base64().min(1).max(5_000_000), mimeType: z.enum(["audio/ogg", "audio/mp4"]) }),
]);

export const parentsTelegram = new Hono()
  // Sends each opted-in parent a voice note in the child's home language, with the steps in Hindi as the
  // caption and a "हो गया 👍" button. Children whose parent hasn't opted in are returned, not sent.
  .post("/parents/send", json(Send), async (c) => {
    const { kind, conceptId, childIds } = c.req.valid("json");
    const concept = concepts.find((x) => x.id === conceptId);
    const texts = kind === "catch_up" ? concept?.catchUp : kits.find((k) => k.conceptId === conceptId)?.parentActivity;
    if (!texts) return c.json({ error: `No ${kind === "catch_up" ? "catch-up lesson" : "kit"} for ${conceptId}` }, 400);
    const children = Child.array().parse((await run(db().from("children").select().in("id", childIds))).map(camel));

    const messages: ParentMessage[] = [];
    const failed: { childId: string; error: string }[] = [];
    for (const child of children.filter((x) => x.parentChatId)) {
      const message: ParentMessage = {
        id: crypto.randomUUID(),
        classId: child.classId,
        childId: child.id,
        kind,
        conceptId,
        file: "",
        text: null,
        status: "failed",
        telegramMessageId: null,
        sentAt: null,
      };
      try {
        message.file = await voiceNote(texts[child.homeLanguage], child.homeLanguage);
        const sent = await telegram<{ message_id: number }>("sendVoice", {
          chat_id: child.parentChatId,
          voice: publicUrl(message.file),
          caption: `${child.name} के लिए:\n${texts.hindi}`.slice(0, 1024),
          reply_markup: { inline_keyboard: [[{ text: "हो गया 👍", callback_data: `done:${message.id}` }]] },
        });
        Object.assign(message, { status: "sent", telegramMessageId: sent.message_id, sentAt: new Date().toISOString() });
      } catch (e) {
        failed.push({ childId: child.id, error: (e as Error).message });
      }
      await run(db().from("parent_messages").insert(snake(message)));
      messages.push(message);
    }
    return c.json({ messages, failed, notOptedIn: children.filter((x) => !x.parentChatId).map((x) => x.id) });
  })

  // Sends the teacher's reply to a child's parent, headed with the child's name for parents of siblings.
  .post("/parents/reply", json(Reply), async (c) => {
    const body = c.req.valid("json");
    const [row] = await run(db().from("children").select().eq("id", body.childId));
    if (!row) return c.json({ error: "Child not found" }, 404);
    const child = Child.parse(camel(row));
    if (!child.parentChatId) return c.json({ error: `${child.name}'s parent isn't on Telegram` }, 409);
    const heading = `शिक्षक का संदेश (${child.name} के लिए)`;
    const message: ParentMessage = {
      id: crypto.randomUUID(),
      classId: child.classId,
      childId: child.id,
      kind: "reply",
      conceptId: null,
      file: null,
      text: "text" in body ? body.text : null,
      status: "failed",
      telegramMessageId: null,
      sentAt: null,
    };
    let problem = "";
    try {
      let sent: { message_id: number };
      if ("text" in body) {
        sent = await telegram("sendMessage", { chat_id: child.parentChatId, text: `${heading}:\n${body.text}` });
      } else {
        const audio = Buffer.from(body.audio, "base64");
        const name = `teacher-${message.id}.${voiceTypes[body.mimeType]}`;
        message.file = `${child.id}/${name}`;
        const { error } = await db().storage.from("parent-media").upload(message.file, audio, { contentType: body.mimeType });
        if (error) throw new Error(error.message);
        const form = new FormData();
        form.set("chat_id", child.parentChatId);
        form.set("caption", heading);
        form.set("voice", new Blob([audio], { type: body.mimeType }), name);
        sent = await telegram("sendVoice", form);
      }
      Object.assign(message, { status: "sent", telegramMessageId: sent.message_id, sentAt: new Date().toISOString() });
    } catch (e) {
      problem = (e as Error).message;
    }
    await run(db().from("parent_messages").insert(snake(message)));
    return problem ? c.json({ error: problem }, 502) : c.json(message, 201);
  })

  // What the class's parents sent back, oldest first.
  .get("/classes/:id/parent-replies", async (c) => {
    const children = await run(db().from("children").select("id").eq("class_id", c.req.param("id")));
    const rows = await run(
      db()
        .from("parent_replies")
        .select()
        .in(
          "child_id",
          children.map((x) => x.id as string),
        )
        .order("received_at"),
    );
    return c.json(ParentReply.array().parse(rows.map(camel)));
  })

  // A voice note in the private bucket (a parent's reply, or the teacher's), through a link that lasts an hour.
  .get("/parent-media/:childId/:name", async (c) => {
    const { childId, name } = c.req.param();
    const { data, error } = await db().storage.from("parent-media").createSignedUrl(`${childId}/${name}`, 3600);
    if (error) return c.json({ error: error.message }, 404);
    return c.redirect(data.signedUrl);
  })

  // Telegram calls this with every update. Only Telegram knows the secret (set by telegram:webhook).
  // It answers at once, because Telegram sends an update again when the answer is slow.
  .post("/telegram/webhook", async (c) => {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret || c.req.header("X-Telegram-Bot-Api-Secret-Token") !== secret) return c.json({ error: "Forbidden" }, 403);
    const update = (await c.req.json()) as Update;
    handle(update).catch((e) => console.error("Telegram update failed:", e));
    return c.json({ ok: true });
  });

// The parts of Telegram's Update this uses.
type Update = {
  message?: {
    chat: { id: number };
    text?: string;
    voice?: { file_id: string };
    reply_to_message?: { message_id: number };
  };
  callback_query?: { id: string; data?: string };
};

const say = (chatId: number, text: string) => telegram("sendMessage", { chat_id: chatId, text });
const reply = (r: Omit<ParentReply, "id" | "receivedAt">) =>
  run(db().from("parent_replies").insert(snake({ id: crypto.randomUUID(), receivedAt: new Date().toISOString(), ...r })));

async function handle({ message, callback_query }: Update) {
  if (callback_query) {
    // "done:<parent message id>", from the button under a voice note.
    const messageId = callback_query.data?.match(/^done:(.+)$/)?.[1];
    const [sent] = messageId ? await run(db().from("parent_messages").select("child_id").eq("id", messageId)) : [];
    // A second tap on the same button isn't stored again.
    const [tapped] = sent ? await run(db().from("parent_replies").select("id").eq("message_id", messageId!).eq("type", "done")) : [];
    if (sent && !tapped) {
      await reply({ childId: sent.child_id as string, messageId: messageId!, type: "done", text: null, file: null, transcript: null });
    }
    await telegram("answerCallbackQuery", { callback_query_id: callback_query.id, text: "धन्यवाद! 👍" });
    return;
  }
  if (!message) return;
  const chatId = message.chat.id;

  // A parent scanned a child's QR code: "/start <child id>". The whole id, because the demo children's ids
  // differ only at the end.
  if (message.text?.startsWith("/start")) {
    const code = message.text.split(/\s+/)[1];
    if (!code) return say(chatId, "नमस्ते! जुड़ने के लिए शिक्षक से मिला अपने बच्चे का QR कोड स्कैन करें।");
    const [row] = z.uuid().safeParse(code).success ? await run(db().from("children").select().eq("id", code)) : [];
    if (!row) return say(chatId, "यह QR कोड पहचान में नहीं आया। कृपया शिक्षक से नया कोड लें।");
    const child = Child.parse(camel(row));
    // Siblings: one parent scans each child's code, and the children share the chat.
    await run(
      db()
        .from("children")
        .update({ parent_chat_id: String(chatId), parent_opt_in_at: new Date().toISOString() })
        .eq("id", child.id),
    );
    return say(
      chatId,
      `नमस्ते! अब आपको ${child.name} की पढ़ाई के लिए आवाज़ वाले संदेश यहीं मिलेंगे। सुनने के बाद "हो गया 👍" दबाएँ, या आवाज़ में जवाब भेजें।`,
    );
  }

  const child = await childForChat(chatId, message.reply_to_message?.message_id);
  if (!child) return say(chatId, "पहले शिक्षक से मिला अपने बच्चे का QR कोड स्कैन करें।");
  if (message.voice) {
    const audio = await telegramFile(message.voice.file_id);
    const file = `${child.id}/${crypto.randomUUID()}.ogg`;
    const { error } = await db().storage.from("parent-media").upload(file, audio, { contentType: "audio/ogg" });
    if (error) throw new Error(error.message);
    // Saaras doesn't do Bhili, so a Bhili reply is kept as audio only.
    const transcript = child.homeLanguage === "hindi" ? await transcribe(audio, "audio/ogg") : null;
    await reply({ childId: child.id, messageId: null, type: "voice", text: null, file, transcript });
  } else if (message.text) {
    await reply({ childId: child.id, messageId: null, type: "text", text: message.text, file: null, transcript: null });
  } else return;
  await say(chatId, "धन्यवाद! आपका संदेश शिक्षक तक पहुँच गया।");
}

// Whose parent this is: the child of the voice note being replied to, or else of the latest one sent to
// this chat, or else the first child who shares the chat.
async function childForChat(chatId: number, replyTo: number | undefined) {
  const children = Child.array().parse((await run(db().from("children").select().eq("parent_chat_id", String(chatId)))).map(camel));
  if (children.length === 0) return undefined;
  const sent = await run(
    db()
      .from("parent_messages")
      .select("child_id, telegram_message_id")
      .in(
        "child_id",
        children.map((x) => x.id),
      )
      .eq("status", "sent")
      .order("sent_at", { ascending: false }),
  );
  const match = sent.find((m) => m.telegram_message_id === replyTo) ?? sent[0];
  return children.find((x) => x.id === match?.child_id) ?? children[0];
}
