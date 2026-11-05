import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { api, type Pod } from '../../api';
import { QrCode } from '../../components/QrCode';
import { ErrorAlert } from '../../components/ui';

/** Printable QR sticker for a pod (SRS 2.5 — each pod carries a scannable code). */
export function AdminPodLabel() {
  const { id } = useParams();
  const [pod, setPod] = useState<Pod | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api.get<{ pod: Pod }>(`/api/pods/${id}`).then((r) => setPod(r.pod)).catch(setError);
  }, [id]);
  if (error) return <ErrorAlert error={error} />;
  if (!pod) return null;
  const url = `${location.origin}/checkin?pod=${pod.id}`;
  return (
    <div className="stack">
      <div className="row no-print">
        <button onClick={() => window.print()}>Print label</button>
        <span className="muted small">{url}</span>
      </div>
      <div className="card label-sheet">
        <h2>{pod.name}</h2>
        <div className="mono">{pod.label}</div>
        <QrCode value={url} label={`Check-in QR code for ${pod.label}`} />
        <strong>Scan to check in</strong>
        <span className="muted small">
          {pod.building}, Floor {pod.floor} · Reserve at {location.host}
        </span>
      </div>
    </div>
  );
}
