import {
  Folder,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileCode,
  FileArchive,
  FileAudio,
  FileType,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { kindOf, isImage, type FileKind } from '../utils/fileMeta';
import type { Entry } from '@linkdrive/shared/types';
import { extname } from '@linkdrive/shared/paths';
import { useExplorerSource } from './ExplorerContext';
import { shellIcon } from '../utils/shell';

const ICONS: Record<FileKind, typeof Folder> = {
  folder: Folder,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  code: FileCode,
  text: FileText,
  archive: FileArchive,
  document: FileType,
  other: File,
};

export function FileIcon({
  entry,
  size,
  withThumbnail = true,
}: {
  entry: Entry;
  size: number;
  withThumbnail?: boolean;
}) {
  const kind = kindOf(entry);
  const Icon = ICONS[kind];
  const src = useExplorerSource();

  if (withThumbnail && isImage(entry) && size >= 24 && src?.fileUrl) {
    return (
      <div
        className="shrink-0 bg-ld-elevated rounded overflow-hidden flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <img
          src={src.fileUrl(entry.path)}
          loading="lazy"
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Try to use the OS shell icon for local non-folder entries. Falls back to
  // lucide glyphs if the shell lookup fails or we're on a non-Windows
  // platform.
  const useShell =
    src?.kind === 'local' && !entry.isDir && (size >= 14 ? true : false);
  if (useShell) {
    return (
      <ShellIconImg entry={entry} size={size} FallbackIcon={Icon} kind={kind} />
    );
  }

  const color = kind === 'folder' ? 'text-brand-red' : 'text-ld-text-muted';
  return (
    <Icon
      size={size * 0.75}
      className={`${color} shrink-0`}
      strokeWidth={1.5}
      style={{ width: size, height: size }}
    />
  );
}

function ShellIconImg({
  entry,
  size,
  FallbackIcon,
  kind,
}: {
  entry: Entry;
  size: number;
  FallbackIcon: typeof Folder;
  kind: FileKind;
}) {
  const ext = extname(entry.path);
  const large = size >= 28;
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!ext) {
      setFailed(true);
      return;
    }
    shellIcon(ext, large).then((u) => {
      if (cancelled) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ext, large]);

  if (failed || !url) {
    const color = kind === 'folder' ? 'text-brand-red' : 'text-ld-text-muted';
    return (
      <FallbackIcon
        size={size * 0.75}
        className={`${color} shrink-0`}
        strokeWidth={1.5}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      className="shrink-0"
      style={{ imageRendering: large ? 'auto' : 'pixelated' }}
    />
  );
}
