import sharp, { type Metadata } from 'sharp';
import { imageEnv } from '../env.js';
import { validationError, type ApiError } from '../errors.js';

// Upload validation and variant generation (technical design section 8). The
// decoded image is the source of truth: the declared MIME type and the filename
// are never trusted, and nothing derived from either reaches the filesystem.

export const IMAGE_VARIANTS = ['card', 'detail'] as const;
export type ImageVariant = (typeof IMAGE_VARIANTS)[number];

export function isImageVariant(value: string): value is ImageVariant {
  return (IMAGE_VARIANTS as readonly string[]).includes(value);
}

// Only formats we are willing to decode. Anything else - SVG in particular,
// which sharp would otherwise render - is rejected before processing.
const ACCEPTED_FORMATS: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

// A decode-side guard against decompression bombs: a small compressed file can
// still declare an enormous pixel surface, and the byte limit alone does not
// catch that.
const MAX_SOURCE_PIXELS = 50_000_000;
const MAX_SOURCE_DIMENSION = 20_000;

export interface ImageVariantOutput {
  data: Buffer;
  width: number;
  height: number;
}

export interface ProcessedImage {
  sourceMediaType: string;
  sourceByteSize: number;
  card: ImageVariantOutput;
  detail: ImageVariantOutput;
}

function uploadError(message: string): ApiError {
  return validationError(message, { photo: [message] });
}

export function assertWithinByteLimit(byteSize: number): void {
  const { maxBytes } = imageEnv();

  if (byteSize > maxBytes) {
    throw uploadError(
      `This image is larger than ${Math.floor(maxBytes / (1024 * 1024))} MB.`,
    );
  }
}

// `withoutEnlargement` keeps a small upload at its own size rather than
// upscaling it, so a variant is never blurrier than the source.
async function renderVariant(source: Buffer, maxWidth: number): Promise<ImageVariantOutput> {
  const { data, info } = await sharp(source, { limitInputPixels: MAX_SOURCE_PIXELS })
    // Applies EXIF orientation and then drops all metadata, so location and
    // camera data never persist.
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height };
}

export async function processUpload(source: Buffer): Promise<ProcessedImage> {
  assertWithinByteLimit(source.byteLength);

  if (source.byteLength === 0) {
    throw uploadError('Choose a photo to upload.');
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(source, { limitInputPixels: MAX_SOURCE_PIXELS }).metadata();
  } catch {
    throw uploadError('This file is not a readable image.');
  }

  const mediaType = metadata.format ? ACCEPTED_FORMATS[metadata.format] : undefined;
  if (!mediaType) {
    throw uploadError('Upload a JPEG, PNG, or WebP image.');
  }

  const { width, height } = metadata;
  if (!width || !height) {
    throw uploadError('This file is not a readable image.');
  }

  if (
    width > MAX_SOURCE_DIMENSION ||
    height > MAX_SOURCE_DIMENSION ||
    width * height > MAX_SOURCE_PIXELS
  ) {
    throw uploadError('This image has too many pixels to process.');
  }

  const { cardMaxWidth, detailMaxWidth } = imageEnv();

  let card: ImageVariantOutput;
  let detail: ImageVariantOutput;
  try {
    // Both variants are re-encoded from the original rather than from each
    // other, so the detail variant never inherits card-sized resampling.
    detail = await renderVariant(source, detailMaxWidth);
    card = await renderVariant(source, cardMaxWidth);
  } catch {
    throw uploadError('This image could not be processed.');
  }

  return {
    sourceMediaType: mediaType,
    sourceByteSize: source.byteLength,
    card,
    detail,
  };
}
