import sharp from 'sharp';
import { ImageCompressorService } from './image-compressor.service';

describe('ImageCompressorService', () => {
  it('compresses a PNG into a WebP buffer under the byte budget', async () => {
    const input = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const service = new ImageCompressorService();
    const result = await service.compress(input);

    expect(result.mime).toBe('image/webp');
    expect(result.ext).toBe('webp');
    expect(result.buffer.byteLength).toBeLessThanOrEqual(256 * 1024);
    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('webp');
  });

  it('caps dimensions at 2048px on the longest side', async () => {
    const input = await sharp({
      create: {
        width: 4000,
        height: 1000,
        channels: 3,
        background: { r: 0, g: 255, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const service = new ImageCompressorService();
    const result = await service.compress(input);
    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBeLessThanOrEqual(2048);
  });
});
