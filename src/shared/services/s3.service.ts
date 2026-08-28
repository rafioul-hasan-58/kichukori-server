import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { EnvConfig } from '../../config/env.schema';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService<EnvConfig, true>) {
    this.s3Client = new S3Client({
      region: this.configService.get('S3_REGION', { infer: true }),
      credentials: {
        accessKeyId: this.configService.get('S3_ACCESS_KEY', { infer: true }),
        secretAccessKey: this.configService.get('S3_SECRET_KEY', {
          infer: true,
        }),
      },
      endpoint:
        this.configService.get('S3_ENDPOINT', { infer: true }) || undefined,
    });
    this.bucketName = this.configService.get('S3_BUCKET_NAME', { infer: true });
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const key = `profile-images/${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    // Return the virtual-hosted style S3 URL
    const region = this.configService.get('S3_REGION', { infer: true });
    return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
  }
}
