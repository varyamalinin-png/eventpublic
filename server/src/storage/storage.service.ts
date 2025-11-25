import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuid } from 'uuid';

type UploadParams = {
  buffer: Buffer;
  mimetype: string;
  originalName: string;
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;
  private readonly maxFileSizeBytes: number;
  private readonly region: string;
  private ensureBucketTask?: Promise<void>;

  constructor(private readonly configService: ConfigService) {
    const driver = this.configService.get<string>('storage.driver', 's3');
    if (driver !== 's3') {
      throw new Error(`Unsupported storage driver: ${driver}`);
    }

    this.region = this.configService.get<string>('storage.region', 'us-east-1');
    const endpoint = this.configService.get<string>('storage.endpoint');
    const forcePathStyle = this.configService.get<boolean>('storage.forcePathStyle', false);
    const accessKeyId = this.configService.get<string>('storage.accessKey');
    const secretAccessKey = this.configService.get<string>('storage.secretKey');

    this.bucket = this.configService.get<string>('storage.bucket', '');
    this.publicBaseUrl = this.configService.get<string>('storage.publicBaseUrl');
    this.maxFileSizeBytes = this.configService.get<number>('storage.maxFileSizeMb', 5) * 1024 * 1024;

    if (!this.bucket) {
      throw new Error('Storage bucket is not configured');
    }

    this.s3 = new S3Client({
      region: this.region,
      endpoint,
      forcePathStyle,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });
    
    // Log configuration for debugging
    this.logger.log(`StorageService initialized: endpoint=${endpoint}, bucket=${this.bucket}, forcePathStyle=${forcePathStyle}, hasCredentials=${!!(accessKeyId && secretAccessKey)}`);
  }

  getMaxFileSizeBytes() {
    return this.maxFileSizeBytes;
  }

  async uploadUserAvatar(userId: string, { buffer, mimetype, originalName }: UploadParams) {
    const key = `users/${userId}/avatars/${uuid()}`;

    try {
      // Try to ensure bucket exists, but don't fail if it already exists
      try {
        await this.ensureBucketExists();
      } catch (error: any) {
        // If bucket check fails with 403, it might already exist - try to upload anyway
        if (error?.code === '403' || error?.Code === '403' || error?.statusCode === 403) {
          this.logger.warn(`Bucket check failed with 403, assuming bucket exists and continuing...`);
        } else {
          throw error;
        }
      }

      const uploader = new Upload({
        client: this.s3,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
          Metadata: {
            originalName,
          },
        },
      });

      await uploader.done();
      this.logger.log(`Avatar uploaded successfully: ${key}`);
    } catch (error) {
      if (this.isMissingBucketError(error)) {
        this.logger.warn(
          `Bucket "${this.bucket}" missing, attempting to create and retry upload...`,
        );
        this.ensureBucketTask = undefined;
        await this.ensureBucketExists();

        return this.uploadUserAvatar(userId, { buffer, mimetype, originalName });
      }

      this.logger.error('Failed to upload avatar', error as Error);
      throw new InternalServerErrorException('Не удалось загрузить изображение');
    }

    return this.buildPublicUrl(key);
  }

  async uploadEventMedia(userId: string, { buffer, mimetype, originalName }: UploadParams) {
    const key = `events/${userId}/${uuid()}-${originalName}`;

    try {
      // Try to ensure bucket exists, but don't fail if it already exists
      try {
        await this.ensureBucketExists();
      } catch (error: any) {
        // If bucket check fails with 403, it might already exist - try to upload anyway
        if (error?.code === '403' || error?.Code === '403' || error?.statusCode === 403) {
          this.logger.warn(`Bucket check failed with 403, assuming bucket exists and continuing...`);
        } else {
          throw error;
        }
      }

      const uploader = new Upload({
        client: this.s3,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
          Metadata: {
            originalName,
          },
        },
      });

      await uploader.done();
      this.logger.log(`Event media uploaded successfully: ${key}`);
    } catch (error) {
      if (this.isMissingBucketError(error)) {
        this.logger.warn(
          `Bucket "${this.bucket}" missing, attempting to create and retry upload...`,
        );
        this.ensureBucketTask = undefined;
        await this.ensureBucketExists();
        // Retry upload
        const retryUploader = new Upload({
          client: this.s3,
          params: {
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: mimetype,
            Metadata: {
              originalName,
            },
          },
        });
        await retryUploader.done();
        this.logger.log(`Event media uploaded successfully after retry: ${key}`);
      } else {
        this.logger.error('Failed to upload event media', error as Error);
        throw new InternalServerErrorException('Не удалось загрузить изображение');
      }
    }

    return this.buildPublicUrl(key);
  }

  async getSignedUploadUrl(userId: string, contentType: string) {
    const key = `users/${userId}/uploads/${uuid()}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 60 * 5 });
    return {
      key,
      url,
      publicUrl: this.buildPublicUrl(key),
    };
  }

  private buildPublicUrl(key: string) {
    if (this.publicBaseUrl) {
      const url = `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
      this.logger.debug(`Built public URL: ${url}`);
      return url;
    }
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  private isMissingBucketError(error: unknown) {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const code = (error as { Code?: string; name?: string }).Code ?? (error as { name?: string }).name;
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;

    return code === 'NoSuchBucket' || status === 404;
  }

  private ensureBucketExists(): Promise<void> {
    if (this.ensureBucketTask) {
      return this.ensureBucketTask;
    }

    this.ensureBucketTask = this.s3
      .send(new HeadBucketCommand({ Bucket: this.bucket }))
      .catch(async (error) => {
        if (!this.isMissingBucketError(error)) {
          throw error;
        }

        this.logger.warn(`Bucket "${this.bucket}" not found. Creating...`);
        // MinIO doesn't require LocationConstraint, so we create bucket without it
        const createCommand = new CreateBucketCommand({ Bucket: this.bucket });

        await this.s3.send(createCommand);
        this.logger.log(`Bucket "${this.bucket}" created successfully.`);
      })
      .then(() => {
        this.logger.debug(`Bucket "${this.bucket}" is ready.`);
      })
      .catch((error: any) => {
        this.ensureBucketTask = undefined;
        const errorMessage = error?.message || String(error);
        const errorCode = error?.Code || error?.code || 'Unknown';
        this.logger.error(`Failed to ensure bucket exists: ${errorCode} - ${errorMessage}`, error);
        throw new InternalServerErrorException(`Ошибка хранения файлов: ${errorCode} - ${errorMessage}`);
      });

    return this.ensureBucketTask;
  }
}

