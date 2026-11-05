import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export function QrCode({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { margin: 1, width: 512, errorCorrectionLevel: 'M' }).then((url) => alive && setSrc(url));
    return () => {
      alive = false;
    };
  }, [value]);
  return <div className="qr">{src && <img src={src} alt={label} />}</div>;
}
