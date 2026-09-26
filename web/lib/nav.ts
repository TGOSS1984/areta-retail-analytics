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

export type NavItem = {
  label: string;
  href: string;
  icon: Icon;
  /** Shown in the page header under the title. */
  question: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", icon: IconLayoutDashboard, question: "The whole business at a glance" },
  { label: "Sales", href: "/sales", icon: IconChartBar, question: "Are we ahead, and when and where?" },
  { label: "Products", href: "/products", icon: IconBox, question: "Which lines carry the range?" },
  { label: "Categories", href: "/categories", icon: IconCategory, question: "How does the mix perform, and where?" },
  { label: "Stores", href: "/stores", icon: IconBuildingStore, question: "Which stores convert and earn their space?" },
  { label: "Digital", href: "/digital", icon: IconDeviceDesktop, question: "How does the website trade and convert?" },
  { label: "Customers", href: "/customers", icon: IconUsers, question: "How do people shop with us?" },
  { label: "Margins", href: "/margins", icon: IconPercentage, question: "Where does the money go?" },
  { label: "Forecasting", href: "/forecasting", icon: IconTrendingUp, question: "Will we hit target?" },
];

export const FOOTER_ITEMS: NavItem[] = [
  { label: "Reports", href: "/reports", icon: IconFileText, question: "Every page and what it answers" },
  { label: "Data", href: "/data", icon: IconDatabase, question: "Can I trust the numbers?" },
];

export function navItemFor(pathname: string): NavItem | undefined {
  return [...NAV_ITEMS, ...FOOTER_ITEMS].find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );
}