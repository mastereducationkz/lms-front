import ImageUploadField from './ImageUploadField';
import { uploadBanner } from '../../services/api/openWebinars';

interface Props {
  /** The stored path (`/uploads/webinar_banners/…`), or null for no banner. */
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

/** The poster of a public webinar: the shared picture upload, with the banner's own copy and endpoint. */
export default function BannerField({ value, onChange, disabled = false }: Props) {
  return <ImageUploadField kind="banner" id="ow-banner" value={value} onChange={onChange} upload={uploadBanner} disabled={disabled} />;
}
