import type { VehicleAttachment } from '@/types/domain';
import { formatBeijingDateTime } from '@/utils/date';

export function attachmentType(file: File): VehicleAttachment['type'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx')) return 'word';
  return 'other';
}

export function fileToVehicleAttachment(file: File): Promise<VehicleAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.onload = () => {
      resolve({
        id: `att-${crypto.randomUUID().slice(0, 8)}`,
        name: file.name,
        type: attachmentType(file),
        url: String(reader.result),
        uploadedAt: formatBeijingDateTime()
      });
    };
    reader.readAsDataURL(file);
  });
}
