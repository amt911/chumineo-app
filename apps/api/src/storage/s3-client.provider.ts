import { Provider } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';

export const S3_CLIENT = 'S3_CLIENT';

export const S3ClientProvider: Provider = {
  provide: S3_CLIENT,
  useFactory: (): S3Client => {
    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    if (endpoint == null || accessKeyId == null || secretAccessKey == null) {
      throw new Error(
        'S3_ENDPOINT, S3_ACCESS_KEY and S3_SECRET_KEY must be set as environment variables.',
      );
    }
    return new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  },
};
