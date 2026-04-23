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
import { fileUrl } from '../utils/fs';
import { kindOf, isImage, type FileKind } from '../utils/fileMeta';
import type { Entry } from '@linkdrive/shared/types';

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

  if (withThumbnail && isImage(entry) && size >= 24) {
    return (
      <div
        className="shrink-0 bg-ld-elevated rounded overflow-hidden flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <img
          src={fileUrl(entry.path)}
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
