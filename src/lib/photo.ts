// ============================================================
// photo.ts — photo decode, HEIC support, crop, compress, upload
// Spec §9.2 Step 3 and §11
// ============================================================

import { PHOTO } from '../config';

export type PhotoPipelineError =
  | 'too_large'
  | 'decode_failed'
  | 'heic_failed'
  | 'too_small'
  | 'compress_failed';

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PreparedPhotoResult {
  ok: boolean;
  error?: PhotoPipelineError;
  message?: string;
  objectUrl?: string;
  file?: File;
  width?: number;
  height?: number;
}

/**
 * Creates an HTMLImageElement from a URL and resolves when loaded.
 */
export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (err) => reject(err));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180;
}

/**
 * Calculates the bounding box of a rotated rectangle.
 */
function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation);
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * Phase 1: Validate file, handle HEIC conversion, decode image, and enforce 400px min dimension.
 * Returns an objectUrl ready for the react-easy-crop UI.
 */
export async function validateAndPreparePhoto(
  file: File,
  onProgress?: (message: string) => void
): Promise<PreparedPhotoResult> {
  // 1. Size guard: 15 MB max before processing
  if (file.size > PHOTO.maxFileSizeMB * 1024 * 1024) {
    return {
      ok: false,
      error: 'too_large',
      message: `This file is too large (max ${PHOTO.maxFileSizeMB} MB). Please choose a smaller photo.`,
    };
  }

  let processedBlob: Blob = file;

  // 2. HEIC/HEIF conversion (lazy-load heic2any)
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.hei[cf]$/i.test(file.name);

  if (isHeic) {
    onProgress?.('Preparing your photo...');
    try {
      const heicModule = await import('heic2any');
      const heic2any = (heicModule.default || heicModule) as unknown as (options: {
        blob: Blob;
        toType?: string;
        quality?: number;
      }) => Promise<Blob | Blob[]>;
      const converted = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.92,
      });
      processedBlob = Array.isArray(converted) ? converted[0] : converted;
    } catch {
      return {
        ok: false,
        error: 'heic_failed',
        message: "We couldn't read this photo. Please choose a JPG or PNG, or take a new photo.",
      };
    }
  }

  // 3. Create object URL & test decode
  const objectUrl = URL.createObjectURL(processedBlob);
  try {
    const img = await createImage(objectUrl);
    const shortSide = Math.min(img.naturalWidth, img.naturalHeight);

    // 4. Reject if shorter side < 400px
    if (shortSide < PHOTO.minShortSidePx) {
      URL.revokeObjectURL(objectUrl);
      return {
        ok: false,
        error: 'too_small',
        message: `This photo is too small or blurry (minimum ${PHOTO.minShortSidePx}px). Please use a clearer one.`,
      };
    }

    return {
      ok: true,
      objectUrl,
      file,
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  } catch {
    URL.revokeObjectURL(objectUrl);
    return {
      ok: false,
      error: 'decode_failed',
      message: "We couldn't read this photo. Please choose a JPG or PNG, or take a new photo.",
    };
  }
}

/**
 * Phase 2: Draw the cropped and rotated area to an 800×800 canvas and compress.
 * Steps quality down (0.85 -> 0.75 -> 0.65 -> 0.55) until the blob is at most 400 KB.
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: PixelCrop,
  rotation = 0
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  const rotRad = getRadianAngle(rotation);
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation);

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = PHOTO.outputSizePx;
  outputCanvas.height = PHOTO.outputSizePx;

  const outCtx = outputCanvas.getContext('2d');
  if (!outCtx) {
    throw new Error('Output canvas 2D context unavailable');
  }

  outCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    PHOTO.outputSizePx,
    PHOTO.outputSizePx
  );

  const qualities = [PHOTO.outputQuality, ...PHOTO.outputQualitySteps];
  for (const q of qualities) {
    const blob = await new Promise<Blob | null>((resolve) =>
      outputCanvas.toBlob(resolve, 'image/jpeg', q)
    );
    if (blob && blob.size <= PHOTO.maxOutputBytes) {
      return blob;
    }
  }

  const fallbackBlob = await new Promise<Blob | null>((resolve) =>
    outputCanvas.toBlob(resolve, 'image/jpeg', qualities[qualities.length - 1])
  );
  if (!fallbackBlob) {
    throw new Error('Failed to compress canvas to blob');
  }
  return fallbackBlob;
}

/**
 * Formats byte size for friendly display (e.g. "245 KB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
