export function BrandGlyph({
  size = 28,
  rounded = 8,
}: {
  size?: number;
  rounded?: number;
}) {
  return (
    <div
      className="bg-brand-red flex items-center justify-center shrink-0"
      style={{ width: size, height: size, borderRadius: rounded }}
    >
      <svg
        width={size * 0.72}
        height={size * 0.72}
        viewBox="0 0 42 42"
        fill="none"
        aria-hidden
      >
        <circle cx="14" cy="21" r="9" stroke="white" strokeWidth="3.5" />
        <circle cx="28" cy="21" r="9" stroke="white" strokeWidth="3.5" />
      </svg>
    </div>
  );
}
