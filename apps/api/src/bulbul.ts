// Hindi speech from Sarvam Bulbul, as MP3. Bulbul doesn't speak Bhili (services/bhili does).
export async function bulbul(text: string): Promise<Buffer> {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error("Set SARVAM_API_KEY in apps/api/.env");
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "api-subscription-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, language_code: "hi-IN", model: "bulbul:v3", output_audio_codec: "mp3" }),
  });
  if (!res.ok) throw new Error(`Sarvam said ${res.status}: ${await res.text()}`);
  const { audios } = (await res.json()) as { audios: string[] };
  return Buffer.from(audios.join(""), "base64");
}
