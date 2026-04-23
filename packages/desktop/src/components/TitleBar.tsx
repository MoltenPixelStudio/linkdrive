import { BrandGlyph } from './BrandGlyph';
import WindowControls from './WindowControls';

export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      className="relative flex items-center h-10 bg-ld-bg border-b border-ld-border shrink-0 select-none"
    >
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 pl-3 pointer-events-none"
      >
        <BrandGlyph size={20} rounded={5} />
        <span className="text-brand-red font-bold text-sm tracking-wider">LINKDRIVE</span>
      </div>
      <WindowControls />
    </div>
  );
}
