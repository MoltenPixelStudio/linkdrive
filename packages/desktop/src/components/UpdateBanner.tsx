import { useEffect, useState } from 'react';
import { ArrowUpCircle, X } from 'lucide-react';
import { shellOpen } from '../utils/shell';

// Current app version — mirror the one in Cargo.toml / tauri.conf.json.
// Bump here when shipping a new tag so the banner stops firing.
const APP_VERSION = '0.1.0';
const RELEASES_API =
  'https://api.github.com/repos/MoltenPixelStudio/linkdrive/releases/latest';
const DISMISS_KEY = 'linkdrive.update.dismissed';

type UpdateInfo = { version: string; url: string };

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

export function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const resp = await fetch(RELEASES_API, {
          headers: { Accept: 'application/vnd.github+json' },
          signal: controller.signal,
        });
        if (!resp.ok) return;
        const rel = (await resp.json()) as { tag_name?: string; html_url?: string };
        const tag = (rel.tag_name ?? '').replace(/^v/, '');
        if (!tag || compareVersions(tag, APP_VERSION) <= 0) return;
        const remote: UpdateInfo = { version: tag, url: rel.html_url ?? '' };
        const last = localStorage.getItem(DISMISS_KEY);
        if (last === remote.version) setDismissed(true);
        setInfo(remote);
      } catch {}
    })();
    return () => controller.abort();
  }, []);

  if (!info || dismissed) return null;

  const openRelease = async () => {
    if (!info.url) return;
    try {
      await shellOpen(info.url);
    } catch {
      window.open(info.url, '_blank');
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, info.version);
    setDismissed(true);
  };

  return (
    <div className="shrink-0 border-b border-ld-border bg-brand-red/10 text-ld-text flex items-center gap-2 px-3 h-8 text-[11.5px] animate-fade-in">
      <ArrowUpCircle size={13} className="text-brand-red" />
      <span className="truncate">
        LinkDrive <span className="font-semibold">v{info.version}</span> is available.
      </span>
      <button
        onClick={openRelease}
        className="ml-auto rounded-md bg-brand-red px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-brand-muted-red"
      >
        View release
      </button>
      <button
        onClick={dismiss}
        className="p-1 rounded hover:bg-ld-elevated text-ld-text-muted"
        title="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  );
}
