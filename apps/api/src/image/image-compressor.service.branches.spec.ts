import sharp from 'sharp';
import { ImageCompressorService } from './image-compressor.service';

jest.mock('sharp');

const mockedSharp = sharp as unknown as jest.Mock;

const MAX_BYTES = 256 * 1024;

function bufferOfSize(bytes: number): Buffer {
  return Buffer.alloc(bytes, 1);
}

/**
 * Builds a chainable fake sharp pipeline. `qualityToBytes` maps the `quality`
 * (and, once resize({width}) is called, the resized width) to an output byte
 * size, letting each test force a specific branch — quality-reduction loop
 * vs. downscale loop — deterministically, without depending on real
 * image-compression internals or slow/flaky real-image iteration.
 */
function makeFakePipeline(options: {
  baseWidth: number | undefined;
  qualityToBytes: (quality: number, resizedWidth?: number) => number;
}) {
  let lastQuality = 0;
  let lastResizeWidth: number | undefined;

  const pipeline: Record<string, jest.Mock> = {};
  pipeline.rotate = jest.fn(() => pipeline);
  pipeline.resize = jest.fn(
    (opts?: { width?: number; height?: number; fit?: string }) => {
      // Only the downscale-branch resize call is a width-only resize
      // ({ width, withoutEnlargement }); the initial fixed resize also
      // passes height/fit, so it's excluded from "resized width" tracking.
      if (
        opts &&
        typeof opts.width === 'number' &&
        opts.height === undefined &&
        opts.fit === undefined
      ) {
        lastResizeWidth = opts.width;
      }
      return pipeline;
    },
  );
  pipeline.clone = jest.fn(() => pipeline);
  pipeline.metadata = jest.fn().mockResolvedValue({ width: options.baseWidth });
  pipeline.webp = jest.fn(({ quality }: { quality: number }) => {
    lastQuality = quality;
    return pipeline;
  });
  pipeline.toBuffer = jest.fn(() =>
    Promise.resolve(
      bufferOfSize(options.qualityToBytes(lastQuality, lastResizeWidth)),
    ),
  );
  return pipeline;
}

describe('ImageCompressorService branch coverage (mocked sharp)', () => {
  beforeEach(() => {
    mockedSharp.mockReset();
  });

  it('returns the first attempt unmodified when it already fits under the byte budget', async () => {
    const pipeline = makeFakePipeline({
      baseWidth: 800,
      qualityToBytes: () => MAX_BYTES - 1,
    });
    mockedSharp.mockReturnValue(pipeline);

    const service = new ImageCompressorService();
    const result = await service.compress(Buffer.from('input'));

    expect(result.mime).toBe('image/webp');
    expect(result.ext).toBe('webp');
    expect(result.buffer.byteLength).toBe(MAX_BYTES - 1);
    // Only the initial attempt at quality 80 — no loop iterations needed.
    expect(pipeline.webp).toHaveBeenCalledTimes(1);
    expect(pipeline.webp).toHaveBeenCalledWith({ quality: 80 });
  });

  it('reduces quality in steps while quality - step stays >= MIN_QUALITY', async () => {
    // Oversized until quality drops to 60 (80 -> 70 -> 60), then fits.
    const pipeline = makeFakePipeline({
      baseWidth: 800,
      qualityToBytes: (quality) =>
        quality <= 60 ? MAX_BYTES - 1 : MAX_BYTES + 1,
    });
    mockedSharp.mockReturnValue(pipeline);

    const service = new ImageCompressorService();
    const result = await service.compress(Buffer.from('input'));

    expect(result.buffer.byteLength).toBe(MAX_BYTES - 1);
    expect(pipeline.webp).toHaveBeenCalledWith({ quality: 80 });
    expect(pipeline.webp).toHaveBeenCalledWith({ quality: 70 });
    expect(pipeline.webp).toHaveBeenCalledWith({ quality: 60 });
    // The downscale branch's width-only resize({width, withoutEnlargement})
    // (no height/fit) was never taken — only the initial fixed resize ran.
    expect(pipeline.resize).toHaveBeenCalledTimes(1);
    expect(pipeline.resize).toHaveBeenCalledWith({
      width: 2048,
      height: 2048,
      fit: 'inside',
      withoutEnlargement: true,
    });
  });

  it('falls back to downscaling once quality would drop below MIN_QUALITY', async () => {
    // Never fits at any quality >= 40, forcing the downscale branch once
    // quality - QUALITY_STEP < MIN_QUALITY (quality stuck at 40).
    let resizeCalls = 0;
    const pipeline = makeFakePipeline({
      baseWidth: 1000,
      qualityToBytes: (_quality, resizedWidth) => {
        if (resizedWidth !== undefined) {
          resizeCalls += 1;
          return resizeCalls >= 1 ? MAX_BYTES - 1 : MAX_BYTES + 1;
        }
        return MAX_BYTES + 1;
      },
    });
    mockedSharp.mockReturnValue(pipeline);

    const service = new ImageCompressorService();
    const result = await service.compress(Buffer.from('input'));

    expect(result.buffer.byteLength).toBe(MAX_BYTES - 1);
    // Quality bottoms out at 40 (80 -> 70 -> 60 -> 50 -> 40), then downscale kicks in.
    expect(pipeline.webp).toHaveBeenCalledWith({ quality: 40 });
    expect(pipeline.resize).toHaveBeenCalledWith(
      expect.objectContaining({
        width: expect.any(Number),
        withoutEnlargement: true,
      }),
    );
  });

  it('uses MAX_DIMENSION as the downscale base width when metadata width is undefined', async () => {
    let sawResizeWidth: number | undefined;
    const pipeline = makeFakePipeline({
      baseWidth: undefined,
      qualityToBytes: (_quality, resizedWidth) => {
        if (resizedWidth !== undefined) {
          sawResizeWidth = resizedWidth;
          return MAX_BYTES - 1;
        }
        return MAX_BYTES + 1;
      },
    });
    mockedSharp.mockReturnValue(pipeline);

    const service = new ImageCompressorService();
    await service.compress(Buffer.from('input'));

    // 2048 (MAX_DIMENSION) * 0.75 (DOWNSCALE_FACTOR) = 1536.
    expect(sawResizeWidth).toBe(1536);
  });

  it('stops after MAX_ITERATIONS even if the byte budget is never met', async () => {
    const pipeline = makeFakePipeline({
      baseWidth: 800,
      qualityToBytes: () => MAX_BYTES + 1,
    });
    mockedSharp.mockReturnValue(pipeline);

    const service = new ImageCompressorService();
    const result = await service.compress(Buffer.from('input'));

    expect(result.buffer.byteLength).toBe(MAX_BYTES + 1);
    // MAX_ITERATIONS = 12: 1 initial attempt + up to 11 loop iterations.
    expect(pipeline.webp.mock.calls.length).toBeLessThanOrEqual(12);
  });
});
