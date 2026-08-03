import { FileValidationSchema, UploadResponseDTO, UploadConfig } from '../../../core/src/upload/schema';
import { IUploadRepository } from './IUploadRepository';

export class UploadService {
  constructor(private readonly uploadRepository: IUploadRepository) {}

  async uploadFile(name: string, type: string, size: number, buffer: Buffer): Promise<UploadResponseDTO> {
    const fileData = { name, type, size };
    const validatedData = FileValidationSchema.parse(fileData);

    return this.uploadRepository.uploadFile(
      buffer,
      validatedData.name,
      validatedData.type,
      validatedData.size
    );
  }

  getConfig() {
    return {
      allowedTypes: UploadConfig.ALLOWED_TYPES,
      maxFileSize: UploadConfig.MAX_SIZE,
      maxSizeLabel: UploadConfig.MAX_SIZE_LABEL,
    };
  }
}
