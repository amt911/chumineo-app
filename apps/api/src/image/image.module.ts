import { Global, Module } from '@nestjs/common';
import { ImageCompressorService } from './image-compressor.service';

@Global()
@Module({
  providers: [ImageCompressorService],
  exports: [ImageCompressorService],
})
export class ImageModule {}
