import type { Icon, IconProps } from "@tabler/icons-react";

// Same visual spec as branding/icons/generate_icons.py's PNG tiles —
// deep-terrain background, summit-gold glyph, same corner-radius-to-size
// ratio — so a live icon here and an exported PNG tile in Power BI read
// as the same icon set, not two independently-styled ones. Works for any
// Tabler icon, not a fixed pre-rendered list, which is the point: this
// covers new icons automatically as the app grows past the current 42.
type IconTileProps = {
  icon: Icon;
  size?: number;
  iconProps?: IconProps;
};

export function IconTile({ icon: TileIcon, size = 40, iconProps }: IconTileProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-[18.75%] bg-deep-terrain"
      style={{ width: size, height: size }}
    >
      <TileIcon
        size={size * 0.5}
        stroke={1.7}
        className="text-summit-gold"
        {...iconProps}
      />
    </div>
  );
}