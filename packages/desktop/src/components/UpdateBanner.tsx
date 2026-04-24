import { useEffect, useState } from 'react';
import { ArrowUpCircle, X, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { shellOpen } from '../utils/shell';

// Current app version — mirror the one in Cargo.toml / tauri.conf.json.
// Bump here when shipping a new tag so the banner stops firing.
const APP_VERSION = '0.2.0';
const RELEASES_API =
  'https://api.github.com/repos/MoltenPixelStudio/linkdrive/releases/latest';
const DISMISS_KEY = 'linkdrive.update.dismissed';

type UpdateInfo = { version: string; url: string; assetUrl?: string | null };

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
        const rel = (await resp.json()) as {
          tag_name?: string;
          html_url?: string;
          assets?: { name: string; browser_download_url: string }[];
        };
        const tag = (rel.tag_name ?? '').replace(/^v/, '');
        if (!tag || compareVersions(tag, APP_VERSION) <= 0) return;
        const asset =
          (rel.assets ?? []).find((a) => a.name.endsWith('-win-x64.exe')) ??
          (rel.assets ?? []).find((a) => a.name.endsWith('.exe'));
        const remote: UpdateInfo = {
          version: tag,
          url: rel.html_url ?? '',
          assetUrl: asset?.browser_download_url,
        };
        const last = localStorage.getItem(DISMISS_KEY);
        if (last === remote.version) setDismissed(true);
        setInfo(remote);
      } catch {}
    })();
    return () => controller.abort();
  }, []);

  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!info || dismissed) return null;

  const openRelease = async () => {
    if (!info.url) return;
    try {
      await shellOpen(info.url);
    } catch {
      window.open(info.url, '_blank');
    }
  };

  const installNow = async () => {
    if (!info.assetUrl) {
      openRelease();
      return;
    }
    setInstalling(true);
    setError(null);
    try {
      const resp = await fetch(info.assetUrl);
      if (!resp.ok) throw new Error(`download failed (${resp.status})`);
      const total = Number(resp.headers.get('content-length') ?? 0);
      const reader = resp.body?.getReader();
      if (!reader) throw new Error('no stream');
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.byteLength;
          if (total > 0) setProgress(received / total);
        }
      }
      // Flatten into a single Uint8Array for IPC.
      const blob = new Uint8Array(received);
      let offset = 0;
      for (const c of chunks) {
        blob.set(c, offset);
        offset += c.byteLength;
      }
      // Tauri IPC serializes Uint8Array via Array; send as plain array.
      await invoke('apply_update', { bytes: Array.from(blob) });
      // Process will exit shortly.
    } catch (e) {
      setError(typeof e === 'string' ? e : (e as Error)?.message ?? 'failed');
      setInstalling(false);
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
        {error && <span className="ml-2 text-brand-red">· {error}</span>}
      </span>

      {installing ? (
        <span className="ml-auto inline-flex items-center gap-1.5 text-ld-text-muted text-[11px]">
          <Loader2 size={11} className="animate-spin" />
          Downloading {progress > 0 ? `${Math.round(progress * 100)}%` : '…'}
        </span>
      ) : (
        <>
          <button
            onClick={openRelease}
            className="ml-auto rounded-md px-2 py-0.5 text-[11px] text-ld-text-muted hover:text-ld-text hover:bg-ld-elevated"
          >
            Release notes
          </button>
          <button
            onClick={installNow}
            disabled={!info.assetUrl}
            className="rounded-md bg-brand-red px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-brand-muted-red disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Install now
          </button>
          <button
            onClick={dismiss}
            className="p-1 rounded hover:bg-ld-elevated text-ld-text-muted"
            title="Dismiss"
          >
            <X size={12} />
          </button>
        </>
      )}
    </div>
  );
}
