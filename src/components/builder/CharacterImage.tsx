import { useEffect, useState } from 'react';
import { db } from '../../lib/db';
import { session, hexToBuf } from '../../lib/security';

interface Props {
  src?: string;
  className?: string;
  alt?: string;
  fallback?: React.ReactNode;
}

export function CharacterImage({ src, className, alt, fallback }: Props) {
  const [objectUrl, setObjectUrl] = useState<string>('');

  useEffect(() => {
    if (!src) {
      setObjectUrl('');
      return;
    }

    if (src.startsWith('local:')) {
      const imageId = src.replace('local:', '');
      let active = true;
      let tempUrl = '';

      const loadImage = async () => {
        try {
          if (session.key) {
            const record = await db.encrypted_images.get(imageId);
            if (record && active) {
              const decryptedBytes = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: hexToBuf(record.ivHex) as any },
                session.key,
                hexToBuf(record.ciphertextHex) as any
              );
              const mime = imageId.startsWith('portrait') ? 'image/jpeg' : 'image/png';
              const blob = new Blob([decryptedBytes], { type: mime });
              tempUrl = URL.createObjectURL(blob);
              setObjectUrl(tempUrl);
            }
          } else {
            const record = await db.images.get(imageId);
            if (record && record.blob && active) {
              tempUrl = URL.createObjectURL(record.blob);
              setObjectUrl(tempUrl);
            }
          }
        } catch (err) {
          console.error('Failed to load local image', err);
        }
      };

      loadImage();

      return () => {
        active = false;
        if (tempUrl) {
          URL.revokeObjectURL(tempUrl);
        }
      };
    } else {
      setObjectUrl(src);
    }
  }, [src]);

  if (!objectUrl) {
    return <>{fallback || <div className={className} />}</>;
  }

  return (
    <img 
      src={objectUrl} 
      alt={alt || 'Character Image'} 
      className={className} 
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}
