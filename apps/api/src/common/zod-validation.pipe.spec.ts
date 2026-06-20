import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(z.object({ name: z.string() }));

  it('returns parsed data when valid', () => {
    expect(pipe.transform({ name: 'ok' })).toEqual({ name: 'ok' });
  });

  it('throws BadRequest when invalid', () => {
    expect(() => pipe.transform({ name: 1 })).toThrow(BadRequestException);
  });
});
