import { useEffect, useRef, useState } from "react";
import BodyGuide from "./BodyGuide.jsx";
import { compressImage } from "../lib/image.js";

export default function CameraCapture({ onClose, onShot, onPickLibrary }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facing, setFacing] = useState("environment");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [guide, setGuide] = useState(true);
  const [count, setCount] = useState(null);
  const [busy, setBusy] = useState(false);
  const timersRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    let stream;

    async function start() {
      setReady(false);
      setError("");
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("このブラウザではカメラを直接開けないよ。ライブラリから選んでね。");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: facing,
            width: { ideal: 1080 },
            height: { ideal: 1920 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch {
        if (!cancelled) setError("カメラを起動できなかったよ。ライブラリから選んでね。");
      }
    }

    start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [facing]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function clearTimers() {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }

  function startCountdown() {
    clearTimers();
    setCount(3);
    timersRef.current = [
      window.setTimeout(() => setCount(2), 1000),
      window.setTimeout(() => setCount(1), 2000),
      window.setTimeout(() => {
        setCount(null);
        capture();
      }, 3000),
    ];
  }

  async function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth || busy) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.drawImage(video, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) throw new Error("写真を作れなかったよ");
      const image = await compressImage(blob);
      onShot(image);
    } catch (captureError) {
      setError(captureError.message || "写真を作れなかったよ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modalBackdrop" role="presentation">
      <div className="cameraModal" role="dialog" aria-modal="true" aria-labelledby="camera-title">
        <div className="cameraBar">
          <button type="button" className="viewerText" onClick={onClose}>
            キャンセル
          </button>
          <h3 id="camera-title">写真</h3>
          <span className="viewerSpacer" />
        </div>
        <div className="viewfinder">
          <video ref={videoRef} playsInline muted autoPlay />
          {guide ? <BodyGuide /> : null}
          <div className="frameMarks" aria-hidden="true" />
          {count != null && count > 0 ? (
            <div className="countdown" aria-live="assertive">
              {count}
            </div>
          ) : null}
        </div>
        <p className="cameraHint">頭から足先まで入れて、毎回同じ向きで立とう</p>
        {error ? <p className="fieldError light">{error}</p> : null}
        <div className="cameraActions">
          <button type="button" aria-pressed={guide} onClick={() => setGuide((value) => !value)}>
            {guide ? "ガイドあり" : "ガイドなし"}
          </button>
          <button
            type="button"
            onClick={() => setFacing((value) => (value === "environment" ? "user" : "environment"))}
          >
            切替
          </button>
          <button type="button" onClick={startCountdown} disabled={!ready || busy || count != null}>
            3秒後
          </button>
          <button type="button" className="shutter" onClick={capture} disabled={!ready || busy} aria-label={busy ? "処理中" : "撮る"}>
            <span />
          </button>
          <button type="button" onClick={onPickLibrary}>
            ライブラリ
          </button>
        </div>
      </div>
    </div>
  );
}
