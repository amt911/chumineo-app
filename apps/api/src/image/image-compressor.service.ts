import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

const MAX_DIMENSION = 2048;
const MAX_BYTES = 256 * 1024;
const START_QUALITY = 80;
const MIN_QUALITY = 40;
const QUALITY_STEP = 10;
const DOWNSCALE_FACTOR = 0.75;
const MAX_ITERATIONS = 12;

export interface CompressedImage {
  buffer: Buffer;
  mime: 'image/webp';
  ext: 'webp';
}

@Injectable()
export class ImageCompressorService {
  async compress(input: Buffer): Promise<CompressedImage> {
    const base = sharp(input).rotate().resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });

    const { width: baseWidth } = await base.clone().metadata();
    let quality = START_QUALITY;
    let scale = 1;
    let best = await base.clone().webp({ quality }).toBuffer();

    for (let i = 1; i < MAX_ITERATIONS && best.byteLength > MAX_BYTES; i += 1) {
      if (quality - QUALITY_STEP >= MIN_QUALITY) {
        quality -= QUALITY_STEP;
        best = await base.clone().webp({ quality }).toBuffer();
      } else {
        scale *= DOWNSCALE_FACTOR;
        const width = Math.max(
          1,
          Math.round((baseWidth ?? MAX_DIMENSION) * scale),
        );
        best = await base
          .clone()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality })
          .toBuffer();
      }
    }

    return { buffer: best, mime: 'image/webp', ext: 'webp' };
  }
}
