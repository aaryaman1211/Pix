import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';
import type { MemoryPhoto } from '@/lib/types';

const BUCKET = 'memory-photos';
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.7;
const SIGNED_URL_TTL_S = 60 * 60;

// Originals stay in the camera roll; we only upload a compressed copy the group can see.
export async function pickPhotos(): Promise<ImagePicker.ImagePickerAsset[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 20,
    quality: 1,
  });
  return result.canceled ? [] : result.assets;
}

async function compress(asset: ImagePicker.ImagePickerAsset) {
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_WIDTH) context.resize({ width: MAX_WIDTH });
  const image = await context.renderAsync();
  return image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
}

export async function uploadPhotos(
  groupId: string,
  memoryId: string,
  assets: ImagePicker.ImagePickerAsset[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  for (const [i, asset] of assets.entries()) {
    onProgress?.(i, assets.length);
    const small = await compress(asset);
    const body = await (await fetch(small.uri)).arrayBuffer();
    const path = `${groupId}/${memoryId}/${Crypto.randomUUID()}.jpg`;

    const upload = await supabase.storage.from(BUCKET).upload(path, body, { contentType: 'image/jpeg' });
    if (upload.error) throw upload.error;

    const { error } = await supabase.from('memory_photos').insert({
      memory_id: memoryId,
      group_id: groupId,
      storage_path: path,
      width: small.width,
      height: small.height,
      local_asset_id: asset.assetId ?? null,
    });
    if (error) throw error;
  }
}

// The memory's chosen cover, or its first photo when none is chosen (or the chosen one is gone).
export function pickCover<T extends { id: string }>(photos: T[], coverId: string | null | undefined): T | undefined {
  return photos.find((p) => p.id === coverId) ?? photos[0];
}

// Returns storage_path -> signed URL. The bucket is private, so URLs expire.
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_S);
  if (error) throw error;
  return Object.fromEntries(data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])));
}

export async function deletePhotos(photos: Pick<MemoryPhoto, 'storage_path'>[]) {
  if (photos.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(photos.map((p) => p.storage_path));
  if (error) throw error;
}
