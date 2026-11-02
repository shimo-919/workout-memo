async function loadImageSource(file) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw(ctx, width, height) {
        ctx.drawImage(bitmap, 0, 0, width, height);
      },
      close() {
        bitmap.close?.();
      },
    };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("decode-failed"));
      element.src = url;
    });

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw(ctx, width, height) {
        ctx.drawImage(image, 0, 0, width, height);
      },
      close() {
        URL.revokeObjectURL(url);
      },
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function compressImage(file, { maxEdge = 1440, quality = 0.82 } = {}) {
  if (!file) throw new Error("画像が選ばれていないよ");

  let source;
  try {
    source = await loadImageSource(file);
  } catch {
    throw new Error("この画像は読み込めなかったよ。JPEGかPNGを選んでね");
  }

  try {
    const longest = Math.max(source.width, source.height) || 1;
    const scale = Math.min(1, maxEdge / longest);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    source.draw(ctx, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("写真を保存用に変換できなかったよ");
    return { blob, width, height };
  } finally {
    source.close();
  }
}
