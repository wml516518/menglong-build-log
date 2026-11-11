import { useEffect } from 'react';

/** Brief renderer loading boundary; the experience owns the operational timeline. */
export function SceneFallback({ onUnavailable }: { onUnavailable?: () => void }) {
  useEffect(() => { onUnavailable?.(); }, [onUnavailable]);
  return <div className="scene-fallback" role="status"><p>正在展开历史年表…</p></div>;
}
