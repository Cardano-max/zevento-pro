import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  width: number;
  height: number;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly isDevelopment = process.env.NODE_ENV === 'development';

  private isMockMode(): boolean {
    return (
      this.isDevelopment &&
      (!process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET)
    );
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: string,
  ): Promise<CloudinaryUploadResult> {
    if (this.isMockMode()) {
      this.logger.warn(
        'Cloudinary env vars not set — returning mock upload data (dev mode)',
      );
      return {
        publicId: `dev-mock-${Date.now()}`,
        url: 'https://via.placeholder.com/400x300',
        width: 400,
        height: 300,
      };
    }

    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            folder,
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
          },
          (error, result) => {
            if (error || !result) {
              return reject(error || new Error('Upload failed'));
            }
            resolve(result);
          },
        );

        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      });

      return {
        publicId: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
      };
    } catch (error) {
      this.logger.error(`Cloudinary upload failed: ${error}`);
      throw new BadRequestException(
        'Image upload failed. Please try again with a valid image file.',
      );
    }
  }

  async deleteImage(publicId: string): Promise<void> {
    if (this.isMockMode()) {
      this.logger.warn(
        `Cloudinary mock: would delete ${publicId} (dev mode)`,
      );
      return;
    }

    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      this.logger.error(`Cloudinary delete failed for ${publicId}: ${error}`);
      throw new BadRequestException('Failed to delete image.');
    }
  }
}
