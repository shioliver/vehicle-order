// S3 图片存储服务
// 使用 Cognito Identity Pool 获取临时凭证，直连 S3
// 当 Cognito 未配置时自动降级为 localStorage

import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import type { InspectionImage } from '@/types/domain';

// ===== 配置 =====
const BUCKET_NAME = 'vehicle-order-images-shi';
const REGION = 'ap-northeast-1';
const IDENTITY_POOL_ID = 'ap-northeast-1:eb91061a-46c1-4335-97c0-8d2aed890e22';
const S3_PREFIX = 'inspection-images/';
const LS_PREFIX = 'ls_inspection_';
const URL_EXPIRY = 3600; // 签名 URL 有效期（秒）

// ===== S3 Client（懒初始化）=====
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  s3Client = new S3Client({
    region: REGION,
    credentials: fromCognitoIdentityPool({
      clientConfig: { region: REGION },
      identityPoolId: IDENTITY_POOL_ID,
    }),
  });

  return s3Client;
}

// ===== localStorage 降级 =====
const localStorageBackend = {
  async upload(dataUrl: string, name: string, size: number): Promise<InspectionImage> {
    const id = LS_PREFIX + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    try {
      localStorage.setItem(id, JSON.stringify({ dataUrl, name, size }));
    } catch {
      throw new Error('localStorage 空间不足，请清理浏览器缓存');
    }
    return {
      id,
      name,
      dataUrl,
      size,
      uploadedAt: new Date().toISOString(),
    };
  },

  async delete(imageId: string): Promise<void> {
    localStorage.removeItem(imageId);
  },

  async getUrl(image: InspectionImage): Promise<string> {
    return image.dataUrl;
  },
};

// ===== S3 上传 =====
async function s3Upload(
  fileOrDataUrl: File | string,
  name: string,
  size: number
): Promise<InspectionImage> {
  const client = getS3Client();
  const key = `${S3_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${sanitizeFilename(name)}`;

  let body: File | Blob;
  let contentType = 'image/jpeg';

  if (fileOrDataUrl instanceof File) {
    body = fileOrDataUrl;
    contentType = fileOrDataUrl.type || 'image/jpeg';
  } else {
    // base64 → Blob
    const res = await fetch(fileOrDataUrl);
    body = await res.blob();
  }

  // 使用 Upload 类（支持大文件分片）
  const upload = new Upload({
    client,
    params: {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    },
    queueSize: 3,
    partSize: 5 * 1024 * 1024,
  });

  await upload.done();

  // 获取签名 URL
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
    { expiresIn: URL_EXPIRY }
  );

  return {
    id: key,
    name,
    dataUrl: url,
    size,
    uploadedAt: new Date().toISOString(),
  };
}

// ===== S3 删除 =====
async function s3Delete(imageId: string): Promise<void> {
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: imageId,
    })
  );
}

// ===== S3 获取/刷新 URL =====
async function s3GetUrl(image: InspectionImage): Promise<string> {
  const client = getS3Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: image.id }),
    { expiresIn: URL_EXPIRY }
  );
}

// ===== 工具函数 =====
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name, { type: 'image/jpeg' });
}

// ===== 检测是否使用 localStorage 降级 =====
function isCognitoConfigured(): boolean {
  return !!IDENTITY_POOL_ID && IDENTITY_POOL_ID.includes(':');
}

// ===== 公开 API =====

/**
 * 上传图片（自动选择 S3 或 localStorage）
 */
export async function uploadImage(
  fileOrDataUrl: File | string,
  name: string,
  size: number
): Promise<InspectionImage> {
  if (!isCognitoConfigured()) {
    const dataUrl = typeof fileOrDataUrl === 'string'
      ? fileOrDataUrl
      : await fileToDataUrl(fileOrDataUrl);
    return localStorageBackend.upload(dataUrl, name, size);
  }

  try {
    const file = fileOrDataUrl instanceof File
      ? fileOrDataUrl
      : await dataUrlToFile(fileOrDataUrl, name);
    return await s3Upload(file, name, size);
  } catch (err) {
    console.warn('S3 上传失败，降级到 localStorage:', (err as Error).message);
    const dataUrl = typeof fileOrDataUrl === 'string'
      ? fileOrDataUrl
      : await fileToDataUrl(fileOrDataUrl);
    return localStorageBackend.upload(dataUrl, name, size);
  }
}

/**
 * 删除图片
 */
export async function deleteImage(imageId: string): Promise<void> {
  if (!isCognitoConfigured() || imageId.startsWith(LS_PREFIX)) {
    return localStorageBackend.delete(imageId);
  }

  try {
    await s3Delete(imageId);
  } catch (err) {
    console.warn('S3 删除失败:', (err as Error).message);
  }
}

/**
 * 获取/刷新图片 URL（S3 签名 URL 过期时调用）
 */
export async function getImageUrl(image: InspectionImage): Promise<string> {
  if (!isCognitoConfigured() || image.id.startsWith(LS_PREFIX)) {
    return localStorageBackend.getUrl(image);
  }

  try {
    return await s3GetUrl(image);
  } catch (err) {
    console.warn('S3 URL 刷新失败，使用缓存 URL:', (err as Error).message);
    return image.dataUrl;
  }
}

/**
 * 判断当前是否使用 localStorage 降级
 */
export function isUsingLocalStorage(): boolean {
  return !isCognitoConfigured();
}
