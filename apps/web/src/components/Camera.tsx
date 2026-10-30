import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// A full-screen camera for taking several slate photos in a row. The phone's own camera app
// (`<input capture>`) takes one shot and returns, so this keeps the camera open until Done.
export function Camera({ onDone, onCancel }: { onDone: (files: File[]) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [shots, setShots] = useState<{ file: File; url: string }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let stream: MediaStream | undefined;
    let closed = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't open the camera here. Choose photos from the gallery instead.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => {
        if (closed) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch((e: Error) => setError(`Couldn't open the camera (${e.message}). Choose photos from the gallery instead.`));
    return () => {
      closed = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Frees the thumbnails' memory when the camera closes.
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  function shoot() {
    const v = video.current;
    if (!v?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        urls.current.push(url);
        setShots((s) => [...s, { file: new File([blob], `Photo ${s.length + 1}.jpg`, { type: "image/jpeg" }), url }]);
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {error ? (
        <p className="m-auto max-w-sm p-6 text-center">{error}</p>
      ) : (
        <video ref={video} autoPlay playsInline muted className="min-h-0 flex-1 object-contain" />
      )}
      {shots.length > 0 && (
        <div className="flex gap-2 overflow-x-auto p-2">
          {shots.map((s) => (
            <img key={s.url} src={s.url} alt={s.file.name} className="h-16 rounded border border-white/40" />
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 items-center gap-3 p-4">
        <Button variant="secondary" className="h-12" onClick={onCancel}>
          Cancel
        </Button>
        <button
          aria-label="Take photo"
          disabled={!!error}
          onClick={shoot}
          className="mx-auto size-16 rounded-full border-4 border-white bg-white/30 active:bg-white disabled:opacity-30"
        />
        <Button className="h-12" disabled={shots.length === 0} onClick={() => onDone(shots.map((s) => s.file))}>
          Done ({shots.length})
        </Button>
      </div>
    </div>
  );
}
