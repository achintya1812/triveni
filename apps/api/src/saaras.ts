// Speech to text from Sarvam Saaras, in code-mixed mode: teachers mix Hindi and English ("borrowing, page 65").
// saaras:v4, because it takes key terms and writes "page 65" in digits, where v3 wrote "पेज पैंसठ".
// A request takes audio under 30 seconds.
export async function transcribe(audio: Buffer, mimeType: string, keyterms: string[] = []): Promise<string> {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error("Set SARVAM_API_KEY in apps/api/.env");
  // Sarvam takes "audio/webm" but not the browser's "audio/webm;codecs=opus".
  const type = mimeType.split(";")[0];
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type }), `note.${type.split("/")[1]}`);
  form.append("model", "saaras:v4");
  form.append("mode", "codemix");
  form.append("language_code", "hi-IN");
  // At most 50 terms of up to 64 characters each.
  if (keyterms.length > 0) form.append("keyterms", JSON.stringify(keyterms.slice(0, 50).map((t) => t.slice(0, 64))));
  const res = await fetch("https://api.sarvam.ai/speech-to-text", {
    method: "POST",
    headers: { "api-subscription-key": key },
    body: form,
  });
  if (!res.ok) throw new Error(`Sarvam said ${res.status}: ${await res.text()}`);
  const { transcript } = (await res.json()) as { transcript: string };
  return transcript;
}
