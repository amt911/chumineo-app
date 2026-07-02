import { Global, Module } from '@nestjs/common';
import { S3ClientProvider } from './s3-client.provider';
import { StorageService } from './storage.service';
import { S3BucketInitializer } from './s3-bucket-initializer';

@Global()
@Module({
  providers: [S3ClientProvider, StorageService, S3BucketInitializer],
  exports: [StorageService],
})
export class StorageModule {}
