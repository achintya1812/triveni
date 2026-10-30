import { SlateReading } from "@triveni/core";
import { useRef, useState } from "react";
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

// Takes or picks photos of slates, five to eight slates per photo, and has Claude read each one.
export function SlatePhotos({ onRead }: { onRead: (reading: SlateReading) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState("");

  async function read(files: File[]) {
    setError("");
    setLeft(files.length);
    for (const file of files) {
      try {
        const res = await api("POST", "/slates/read", { image: await resize(file), mediaType: "image/jpeg" });
        onRead(SlateReading.parse(await res.json()));
      } catch (e) {
        setError(`Couldn't read ${file.name}: ${(e as Error).message}. Take it again, or type those answers.`);
      }
      setLeft((n) => n - 1);
    }
  }

  return (
    <div className="space-y-1">
      <Button variant="outline" className="h-12 w-full" disabled={left > 0} onClick={() => input.current?.click()}>
        {left > 0 ? `Reading photos… (${left} left)` : "Read slates from photos"}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) read(files);
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
