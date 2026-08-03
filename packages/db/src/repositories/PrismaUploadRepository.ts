import { PrismaClient } from '@prisma/client';
import { IUploadRepository } from '../../../application/src/upload/IUploadRepository';
import { UploadResponseDTO } from '../../../core/src/upload/schema';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export class PrismaUploadRepository implements IUploadRepository {
  constructor(private readonly db: PrismaClient) {}

  async uploadFile(buffer: Buffer, name: string, type: string, size: number): Promise<UploadResponseDTO> {
    const ext = name.split('.').pop() || 'bin';
    const uniqueName = `${randomUUID()}.${ext}`;
    const subDir = new Date().toISOString().slice(0, 7);
    const dir = join(process.cwd(), 'public', 'uploads', subDir);

    await mkdir(dir, { recursive: true });
    const filePath = join(dir, uniqueName);
    await writeFile(filePath, buffer);

    const url = `/uploads/${subDir}/${uniqueName}`;
    
    return {
      url,
      name,
      size,
      type,
    };
  }
}
