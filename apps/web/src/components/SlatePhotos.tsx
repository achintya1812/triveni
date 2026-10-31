import { type Child, SlateReading } from "@triveni/core";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera } from "@/components/Camera";
import { Button } from "@/components/ui/button";
import { api, db, isNetworkError } from "@/db";

// Shrinks a photo so its long side is at most 1500 px, which saves tokens and data, as base64 JPEG.
async function resize(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1500 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

// How many photos are read at the same time.
const atOnce = 3;

// Picks photos from the gallery (several at once) or takes several in a row with the in-app camera,
// five to eight slates per photo, and has Claude read them, a few at a time, with the class list.
// The photos wait in Dexie until they're read: with no signal they stay waiting, and are read when the
// signal returns (while this screen is open). `onRead` gets each photo's number, counting from 1.
export function SlatePhotos({
  checkId,
  roster,
  rows,
  onRead,
}: {
  checkId: string;
  roster: Child[];
  rows: number;
  onRead: (reading: SlateReading, photo: number) => Promise<void>;
}) {
  const { t } = useTranslation("check");
  const gallery = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const photos = useLiveQuery(() => db.photos.where({ checkId }).sortBy("number"), [checkId]) ?? [];
  // Photos being read by this screen, so a photo isn't sent twice while Dexie catches up.
  const reading = useRef(new Set<number>());

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  async function add(files: File[]) {
    const count = await db.photos.where({ checkId }).count();
    await db.photos.bulkAdd(files.map((file, i) => ({ checkId, number: count + i + 1, file, state: "waiting" as const })));
  }

  // Starts waiting photos while fewer than `atOnce` are being read. A photo left "reading" by a closed screen
  // counts as waiting again.
  useEffect(() => {
    if (!online) return;
    const waiting = photos.filter((p) => p.state !== "read" && p.state !== "failed" && !reading.current.has(p.id!));
    for (const photo of waiting.slice(0, atOnce - reading.current.size)) {
      const id = photo.id!;
      reading.current.add(id);
      db.photos.update(id, { state: "reading", error: undefined });
      resize(photo.file)
        .then((image) =>
          api("POST", "/slates/read", { image, mediaType: "image/jpeg", rows, roster: roster.map((c) => ({ roll: c.rollNo, name: c.name })) }),
        )
        .then(async (res) => onRead(SlateReading.parse(await res.json()), photo.number))
        .then(
          () => db.photos.update(id, { state: "read" }),
          (e: Error) => {
            if (!isNetworkError(e)) return db.photos.update(id, { state: "failed", error: e.message });
            // No signal (or no server): it waits, and is tried again when the signal returns, or in 15 seconds.
            setOnline(false);
            setTimeout(() => setOnline(navigator.onLine), 15_000);
            return db.photos.update(id, { state: "waiting" });
          },
        )
        .finally(() => reading.current.delete(id));
    }
  }, [photos, online, onRead, roster, rows]);

  const read = photos.filter((p) => p.state === "read").length;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12" onClick={() => setCamera(true)}>
          {t("photos.take")}
        </Button>
        <Button variant="outline" className="h-12" onClick={() => gallery.current?.click()}>
          {t("photos.gallery")}
        </Button>
      </div>
      {/* No `capture`: with it, Android opens the camera for one shot and ignores `multiple`. */}
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          add(files);
        }}
      />
      {camera && (
        <Camera
          onCancel={() => setCamera(false)}
          onDone={(files) => {
            setCamera(false);
            add(files);
          }}
        />
      )}
      {photos.length > 0 && (
        <div className="space-y-1 rounded-lg border p-3 text-sm">
          <p className="font-medium">{t("photos.read", { read, total: photos.length })}</p>
          {!online && read < photos.length && <p className="text-amber-800">{t("photos.offline")}</p>}
          <ul className="space-y-1">
            {photos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {p.file.name}: <span className={p.state === "failed" ? "text-destructive" : "text-muted-foreground"}>{t(`photos.states.${p.state}`)}</span>
                  {p.error && <span className="block text-xs text-destructive">{p.error}</span>}
                </span>
                {p.state === "failed" && (
                  <Button size="sm" variant="outline" onClick={() => db.photos.update(p.id!, { state: "waiting" })}>
                    {t("photos.retry")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
