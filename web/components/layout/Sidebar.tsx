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
        <div className="mb-8 flex items-center gap-2 px-2">
          <Image
            src="/images/areta-logo-mark.webp"
            alt=""
            width={28}
            height={14}
            className="h-4 w-auto"
          />
          <div>
            <div className="text-sm tracking-wide text-cloud">Areta</div>
            <div className="text-[10px] tracking-wide text-mist">Retail Analytics</div>
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
        <p className="px-2 text-[11px] leading-relaxed text-mist">
          Explore. Climb. Protect. Belong.
        </p>
      </div>
    </aside>
  );
}