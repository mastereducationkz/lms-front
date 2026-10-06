import imageCompression from 'browser-image-compression';

interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  initialQuality?: number;
}

/**
 * Compresses an image file with a fallback mechanism.
 * If compression with web workers fails (e.g., due to environmental issues), 
 * it retries without web workers.
 */
export async function compressImage(file: File, options: CompressionOptions = {}): Promise<File> {
  const defaultOptions: CompressionOptions = {
    maxSizeMB: 5,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    initialQuality: 0.8,
    ...options
  };

  try {
    console.log(`[Compression] Starting compression for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`[Compression] Options:`, defaultOptions);
    
    let compressedBlob: Blob;
    
    try {
      compressedBlob = await imageCompression(file, defaultOptions);
    } catch (workerError) {
      if (defaultOptions.useWebWorker) {
        console.warn('[Compression] Web worker failed, retrying without web worker...', workerError);
        compressedBlob = await imageCompression(file, { ...defaultOptions, useWebWorker: false });
      } else {
        throw workerError;
      }
    }

    // browser-image-compression returns a File if possible, or a Blob.
    // If it's a larger or same size result, we prefer the original.
    if (compressedBlob.size >= file.size) {
      console.log('[Compression] Compressed file is larger or same size. Keeping original.');
      return file;
    }

    // Wrap the result in a File object to preserve the original name and ensure correct type
    const types = ['image/jpeg', 'image/png', 'image/webp'];
    const type = types.includes(compressedBlob.type) ? compressedBlob.type : file.type;
    
    const compressedFile = new File([compressedBlob], file.name, { type });

    const originalSizeMB = (file.size / 1024 / 1024).toFixed(2);
    const compressedSizeMB = (compressedFile.size / 1024 / 1024).toFixed(2);
    const reductionPercent = ((1 - compressedFile.size / file.size) * 100).toFixed(1);

    console.group('[Compression] Success');
    console.log(`Original: ${originalSizeMB} MB`);
    console.log(`Compressed: ${compressedSizeMB} MB`);
    console.log(`Reduction: ${reductionPercent}%`);
    console.groupEnd();

    return compressedFile;
  } catch (error) {
    console.error('[Compression] Failed:', error);
    // Return original file as fallback to not block the user
    return file;
  }
}
