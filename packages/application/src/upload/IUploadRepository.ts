import { UploadResponseDTO } from '../../../core/src/upload/schema';

export interface IUploadRepository {
  uploadFile(buffer: Buffer, name: string, type: string, size: number): Promise<UploadResponseDTO>;
}
