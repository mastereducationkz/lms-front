const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

/** Renders a message attachment: inline image preview or a file download link. */
export function ChatAttachment({ fileUrl }: { fileUrl: string }) {
  const url = fileUrl.startsWith('http') ? fileUrl : `${BACKEND_URL}${fileUrl}`;
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt="attachment" className="max-w-[220px] max-h-[220px] rounded-lg mb-1 object-cover" />
      </a>
    );
  }
  const fileName = decodeURIComponent(fileUrl.split('/').pop() || 'file');
  return (
    <a href={url} target="_blank" rel="noreferrer" className="underline mb-1 break-all block">
      📎 {fileName}
    </a>
  );
}
