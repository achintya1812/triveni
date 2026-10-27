import { audioClips } from "@triveni/content";
import { db } from "../src/db";

// Upserts the audio manifest into audio_clips. A clip with no `file` is not recorded yet.
const rows = audioClips.map(({ file, ...clip }) => ({
  ...clip,
  url: file ? db().storage.from("audio").getPublicUrl(file).data.publicUrl : null,
}));

const { error } = await db().from("audio_clips").upsert(rows);
if (error) throw new Error(error.message);
console.log(`Upserted ${rows.length} audio clips`);
