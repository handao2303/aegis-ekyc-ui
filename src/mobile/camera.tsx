/*
  Camera thật cho app khách hàng.
  - Chỉ bật khi có CaptureProvider với real=true (trang /app/). Trong UI Kit, các màn dùng ảnh minh hoạ.
  - Ảnh chỉ nằm trong bộ nhớ của tab (data URL), không lưu vào máy và không gửi đi đâu.
  - Không có camera / bị từ chối quyền → tự quay về ảnh minh hoạ, luồng vẫn đi tiếp được.
*/
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

export type PhotoKey = "front" | "back" | "selfie";
type Photos = Partial<Record<PhotoKey, string>>;
type Ctx = { real: boolean; photos: Photos; setPhoto: (k: PhotoKey, url: string | undefined) => void };

const CaptureContext = createContext<Ctx>({ real: false, photos: {}, setPhoto: () => {} });

export function CaptureProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<Photos>({});
  const setPhoto = useCallback((k: PhotoKey, url: string | undefined) => setPhotos((p) => ({ ...p, [k]: url })), []);
  return <CaptureContext.Provider value={{ real: true, photos, setPhoto }}>{children}</CaptureContext.Provider>;
}

export const useCapture = () => useContext(CaptureContext);

export type CameraStatus = "off" | "starting" | "live" | "denied" | "unavailable";

/** Mở camera trước ("user") hoặc sau ("environment"). Tắt hẳn khi rời màn hình. */
export function useCamera(facing: "user" | "environment", enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("off");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      return;
    }
    let cancelled = false;
    setStatus("starting");
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        setStatus("live");
      })
      .catch((e: DOMException) => {
        if (cancelled) return;
        setStatus(e?.name === "NotAllowedError" || e?.name === "SecurityError" ? "denied" : "unavailable");
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing, enabled, attempt]);

  /** Chụp khung hình hiện tại. crop = tỉ lệ khung cần cắt ở giữa (vd. 1.586 cho thẻ CCCD). */
  const capture = useCallback(
    (opts?: { crop?: number; mirror?: boolean; maxWidth?: number }) => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return undefined;
      const vw = v.videoWidth;
      const vh = v.videoHeight;
      let sw = vw;
      let sh = vh;
      if (opts?.crop) {
        // Lấy 90% bề ngang, cao theo tỉ lệ thẻ
        sw = Math.round(Math.min(vw * 0.9, vh * 0.9 * opts.crop));
        sh = Math.round(sw / opts.crop);
      }
      const sx = Math.round((vw - sw) / 2);
      const sy = Math.round((vh - sh) / 2);
      const scale = Math.min(1, (opts?.maxWidth ?? 1280) / sw);
      const c = document.createElement("canvas");
      c.width = Math.round(sw * scale);
      c.height = Math.round(sh * scale);
      const ctx = c.getContext("2d");
      if (!ctx) return undefined;
      if (opts?.mirror) {
        ctx.translate(c.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.85);
    },
    [],
  );

  return { videoRef, status, capture, retry: () => setAttempt((n) => n + 1) };
}
