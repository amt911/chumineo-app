import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { S3_CLIENT } from './s3-client.provider';

const PUBLIC_READ_BUCKETS = ['marketplace-listings'];

function publicReadPolicy(bucket: string): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });
}

@Injectable()
export class S3BucketInitializer implements OnModuleInit {
  constructor(@Inject(S3_CLIENT) private readonly s3: S3Client) {}

  async onModuleInit(): Promise<void> {
    if (process.env.S3_AUTO_CREATE_BUCKETS !== 'true') return;
    for (const bucket of PUBLIC_READ_BUCKETS) {
      await this.ensureBucket(bucket);
    }
  }

  private async ensureBucket(bucket: string): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: bucket }));
    }
    await this.s3.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: publicReadPolicy(bucket),
      }),
    );
  }
}
