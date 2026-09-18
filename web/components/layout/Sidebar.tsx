import Image from "next/image";
import {
  IconLayoutDashboard,
  IconChartBar,
  IconBox,
  IconCategory,
  IconBuildingStore,
  IconDeviceDesktop,
  IconUsers,
  IconPercentage,
  IconTrendingUp,
  IconFileText,
  IconDatabase,
  type Icon,
} from "@tabler/icons-react";

const NAV_ITEMS: { label: string; icon: Icon }[] = [
  { label: "Overview", icon: IconLayoutDashboard },
  { label: "Sales", icon: IconChartBar },
  { label: "Products", icon: IconBox },
  { label: "Categories", icon: IconCategory },
  { label: "Stores", icon: IconBuildingStore },
  { label: "Digital", icon: IconDeviceDesktop },
  { label: "Customers", icon: IconUsers },
  { label: "Margins", icon: IconPercentage },
  { label: "Forecasting", icon: IconTrendingUp },
];

const FOOTER_ITEMS: { label: string; icon: Icon }[] = [
  { label: "Reports", icon: IconFileText },
  { label: "Data", icon: IconDatabase },
];

export function Sidebar({ active = "Overview" }: { active?: string }) {
  return (
    <aside className="flex h-screen w-60 flex-col justify-between bg-deep-terrain px-4 py-6">
      <div>
        <div className="mb-8 px-3">
          {/* fill + object-contain rather than fixed width/height — this
              renders correctly regardless of the cropped asset's actual
              aspect ratio, and object-contain's default center position
              is what keeps it centered here, not extra markup. */}
          <div className="relative h-24 w-full">
            <Image
              src="/images/areta-logo-mark-cropped.png"
              alt="Areta"
              fill
              sizes="240px"
              className="object-contain"
            />
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ label, icon: ItemIcon }) => {
            const isActive = label === active;
            return (
              <a
                key={label}
                href="#"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-summit-gold/15 text-summit-gold"
                    : "text-mist hover:bg-white/5 hover:text-cloud"
                }`}
              >
                <ItemIcon size={18} stroke={1.75} aria-hidden="true" />
                {label}
              </a>
            );
          })}
        </nav>
      </div>

      <div>
        <div className="mb-4 flex flex-col gap-1 border-t border-white/10 pt-4">
          {FOOTER_ITEMS.map(({ label, icon: ItemIcon }) => (
            <a
              key={label}
              href="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-mist transition-colors hover:bg-white/5 hover:text-cloud"
            >
              <ItemIcon size={18} stroke={1.75} aria-hidden="true" />
              {label}
            </a>
          ))}
        </div>
        <p className="mb-4 px-2 text-[11px] leading-relaxed text-mist">
          Explore. Climb. Protect. Belong.
        </p>
        {/* Full-bleed strip at the very bottom — -mx-4/-mb-6 cancel the
            aside's own px-4/py-6 so this reaches all three outer edges
            (left, right, bottom) rather than sitting inset like
            everything else in the sidebar. h-[13vh] ties it to the
            sidebar's own full-viewport height (aside is h-screen), not
            a fixed pixel value, so it stays roughly 10-15% of the
            sidebar regardless of window height. */}
        <div className="relative -mx-4 -mb-6 h-[13vh] overflow-hidden">
          <Image
            src="/images/ridge-shadow.png"
            alt=""
            fill
            className="object-cover"
            sizes="240px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-deep-terrain/40 to-transparent" />
        </div>
      </div>
    </aside>
  );
}