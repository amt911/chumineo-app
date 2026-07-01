import { Inject, Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { S3_CLIENT } from './s3-client.provider';

@Injectable()
export class StorageService {
  constructor(@Inject(S3_CLIENT) private readonly s3: S3Client) {}

  private bucketAndPath(key: string): { bucket: string; path: string } {
    const [bucket, ...rest] = key.split('/');
    return { bucket, path: rest.join('/') };
  }

  async upload(
    key: string,
    data: Buffer,
    mimeType: string,
    cacheControl?: string,
  ): Promise<string> {
    const { bucket, path } = this.bucketAndPath(key);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: data,
        ContentType: mimeType,
        ...(cacheControl !== undefined ? { CacheControl: cacheControl } : {}),
      }),
    );
    return key;
  }

  async delete(key: string): Promise<void> {
    const { bucket, path } = this.bucketAndPath(key);
    await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: path }));
  }

  getPublicUrl(key: string): string {
    const base = process.env.S3_PUBLIC_URL ?? 'http://localhost:9000';
    return `${base}/${key}`;
  }
}
