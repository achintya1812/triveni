import { SlateReading } from "@triveni/core";
import { useEffect, useRef, useState } from "react";
import { Camera } from "@/components/Camera";
import { Button } from "@/components/ui/button";
import { api } from "@/db";

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

type Photo = { id: number; file: File; state: "waiting" | "reading" | "read" | "failed"; error?: string };

// Picks photos from the gallery (several at once) or takes several in a row with the in-app camera,
// five to eight slates per photo, and has Claude read them, a few at a time.
export function SlatePhotos({ onRead }: { onRead: (reading: SlateReading) => Promise<void> }) {
  const gallery = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [camera, setCamera] = useState(false);

  const update = (id: number, change: Partial<Photo>) =>
    setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, ...change } : p)));
  const add = (files: File[]) =>
    setPhotos((ps) => [...ps, ...files.map((file) => ({ id: nextId.current++, file, state: "waiting" as const }))]);

  // Starts waiting photos while fewer than `atOnce` are being read.
  useEffect(() => {
    const busy = photos.filter((p) => p.state === "reading").length;
    for (const photo of photos.filter((p) => p.state === "waiting").slice(0, atOnce - busy)) {
      update(photo.id, { state: "reading", error: undefined });
      resize(photo.file)
        .then((image) => api("POST", "/slates/read", { image, mediaType: "image/jpeg" }))
        .then(async (res) => onRead(SlateReading.parse(await res.json())))
        .then(
          () => update(photo.id, { state: "read" }),
          (e: Error) => update(photo.id, { state: "failed", error: e.message }),
        );
    }
  }, [photos, onRead]);

  const read = photos.filter((p) => p.state === "read").length;
  const label: Record<Photo["state"], string> = { waiting: "Waiting", reading: "Reading…", read: "Read", failed: "Couldn't read" };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12" onClick={() => setCamera(true)}>
          Take photos
        </Button>
        <Button variant="outline" className="h-12" onClick={() => gallery.current?.click()}>
          Choose from gallery
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
          <p className="font-medium">
            {read} of {photos.length} photos read
          </p>
          <ul className="space-y-1">
            {photos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {p.file.name}: <span className={p.state === "failed" ? "text-destructive" : "text-muted-foreground"}>{label[p.state]}</span>
                  {p.error && <span className="block text-xs text-destructive">{p.error}</span>}
                </span>
                {p.state === "failed" && (
                  <Button size="sm" variant="outline" onClick={() => update(p.id, { state: "waiting" })}>
                    Retry
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
