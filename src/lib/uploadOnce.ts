// Remember files already uploaded while a form is open. Saving homework uploads every attached
// file; if one upload fails the whole save fails, and pressing Save again used to re-send the
// files that had already arrived — on 17.09 a teacher's 16.9 MB PDF went up four times over a
// connection that could not finish the second file.

export type UploadResult = { file_url?: string; url?: string } & Record<string, unknown>;

export type UploadCache = {
  /** Upload `file` through `send`, or hand back the result of the upload that already succeeded. */
  upload: (file: File, send: (file: File) => Promise<UploadResult>) => Promise<UploadResult>;
};

export function createUploadCache(): UploadCache {
  // Keyed by the File object itself: picking another file makes a new File, so nothing stale
  // is ever reused. A failed upload is forgotten, so the next Save retries it.
  const uploads = new Map<File, Promise<UploadResult>>();

  return {
    upload(file, send) {
      const existing = uploads.get(file);
      if (existing) return existing;

      const started = send(file).catch((error) => {
        uploads.delete(file);
        throw error;
      });
      uploads.set(file, started);
      return started;
    },
  };
}
