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
import * as path from 'path';

type UploadParams = {
  buffer: Buffer;
  mimetype: string;
  originalName: string;
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  public readonly s3: S3Client; // Изменено на public для доступа из контроллера
  public readonly bucket: string; // Изменено на public для доступа из контроллера
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
    const extension = path.extname(originalName) || '.jpg';
    const key = `events/${userId}/${uuid()}${extension}`;
    
    try {
      const uploader = new Upload({
        client: this.s3,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
        },
      });

      await uploader.done();
      const publicUrl = this.buildPublicUrl(key);
      this.logger.log(`✅ Event media uploaded: ${publicUrl}`);
      return publicUrl;
    } catch (error: any) {
      this.logger.error(`❌ Failed to upload event media: ${error?.message || error}`);
      throw new InternalServerErrorException(`Не удалось загрузить изображение: ${error?.message || 'Unknown error'}`);
    }
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
    // КРИТИЧЕСКИ ВАЖНО: Всегда используем publicBaseUrl если он установлен
    if (this.publicBaseUrl) {
      const url = `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
      this.logger.debug(`Built public URL from publicBaseUrl: ${url}`);
      return url;
    }
    // Fallback: Для Yandex Object Storage используем правильный формат URL
    const endpoint = this.configService.get<string>('storage.endpoint');
    if (endpoint && endpoint.includes('yandexcloud.net')) {
      // Yandex Cloud Object Storage публичный URL
      const yandexUrl = `https://${this.bucket}.storage.yandexcloud.net/${key}`;
      this.logger.debug(`Built public URL from Yandex endpoint: ${yandexUrl}`);
      return yandexUrl;
    }
    // Fallback для AWS S3
    const s3Url = `https://${this.bucket}.s3.amazonaws.com/${key}`;
    this.logger.debug(`Built public URL from S3 fallback: ${s3Url}`);
    return s3Url;
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
      .then(() => {
        this.logger.debug(`Bucket "${this.bucket}" is ready.`);
      })
      .catch(async (error: any) => {
        const statusCode = error?.$metadata?.httpStatusCode || error?.statusCode;
        const errorCode = error?.Code || error?.code || error?.name || 'Unknown';
        
        // КРИТИЧЕСКИ ВАЖНО: Если bucket уже существует (403 или другие ошибки доступа), не бросаем ошибку
        // Просто продолжаем - bucket скорее всего существует, просто нет прав на HEAD
        if (statusCode === 403 || statusCode === 404 || errorCode === '403' || errorCode === 'AccessDenied' || errorCode === 'Forbidden' || error?.message?.includes('AccessDenied') || error?.message?.includes('Forbidden')) {
          this.logger.warn(`Bucket "${this.bucket}" check returned ${statusCode}/${errorCode}, assuming it exists and continuing...`);
          // НЕ бросаем ошибку - просто продолжаем, пытаемся загрузить файл
          return;
        }
        
        // Если bucket не существует, создаем его
        if (this.isMissingBucketError(error)) {
          this.logger.warn(`Bucket "${this.bucket}" not found. Creating...`);
          const createCommand = new CreateBucketCommand({ Bucket: this.bucket });
          try {
            await this.s3.send(createCommand);
            this.logger.log(`Bucket "${this.bucket}" created successfully.`);
            return;
          } catch (createError: any) {
            // Если создание не удалось из-за 403/404, bucket уже существует или нет прав
            const createStatusCode = createError?.$metadata?.httpStatusCode || createError?.statusCode;
            if (createStatusCode === 403 || createStatusCode === 404 || createError?.Code === '403' || createError?.Code === 'BucketAlreadyExists') {
              this.logger.warn(`Bucket "${this.bucket}" creation returned ${createStatusCode}, assuming it already exists`);
              return;
            }
            // Для других ошибок - просто продолжаем, не бросаем исключение
            this.logger.warn(`Bucket "${this.bucket}" creation failed, but continuing anyway: ${createError?.message || createError}`);
            return;
          }
        }
        
        // Для всех остальных ошибок - просто продолжаем, не бросаем исключение
        this.logger.warn(`Failed to ensure bucket exists: ${errorCode} - ${error?.message || error}, but continuing anyway...`);
        this.ensureBucketTask = undefined;
        return; // НЕ бросаем исключение, просто возвращаемся
      });

    return this.ensureBucketTask;
  }
}

