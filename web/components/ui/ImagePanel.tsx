import Image from "next/image";

type ImagePanelProps = {
  imageSrc: string;
  heading: string;
  subheading: string;
};

/** Decorative brand panel — no data, just imagery + a short line, same
 * spirit as the "MORE THAN GEAR" / quote panels on the reference board.
 * Same card shape (rounded-xl, border-white/10) as every data chart so
 * it reads as part of the grid, not a foreign element dropped into it. */
export function ImagePanel({ imageSrc, heading, subheading }: ImagePanelProps) {
  return (
    <div className="relative h-full min-h-[140px] overflow-hidden rounded-xl border border-white/10">
      <Image src={imageSrc} alt="" fill className="object-cover" sizes="360px" />
      <div className="absolute inset-0 bg-gradient-to-t from-deep-terrain via-deep-terrain/30 to-transparent" />
      <div className="absolute bottom-0 left-0 p-4">
        <p className="text-sm font-medium uppercase tracking-wide text-cloud">{heading}</p>
        <p className="mt-0.5 text-xs text-mist">{subheading}</p>
        <div className="mt-2 h-px w-6 bg-summit-gold" />
      </div>
    </div>
  );
}