import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export function imageUploadOptions(): MulterOptions {
  return {
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb): void => {
      if (!/^image\/(jpeg|png|webp)$/.exec(file.mimetype)) {
        cb(new BadRequestException('Only jpeg/png/webp images allowed'), false);
        return;
      }
      cb(null, true);
    },
  };
}
