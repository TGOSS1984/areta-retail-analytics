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
  /** What the page shows, for the Reports index. */
  visuals: string[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", icon: IconLayoutDashboard, question: "The whole business at a glance", visuals: ["KPI cards with 12-month sparklines", "Sales trend vs last year", "Channel and category mix", "Europe map with UK drill-down", "Top products with photos", "Sales and margin by month"] },
  { label: "Sales", href: "/sales", icon: IconChartBar, question: "Are we ahead, and when and where?", visuals: ["Weekly filled line vs last year", "Calendar heatmap of every trading day", "Waterfall from last year by market", "Sales vs phased target by period"] },
  { label: "Products", href: "/products", icon: IconBox, question: "Which lines carry the range?", visuals: ["Style Pareto with the 80% line", "Brand and category treemap", "Price vs volume bubble scatter", "Best and slowest sellers with sparklines"] },
  { label: "Categories", href: "/categories", icon: IconCategory, question: "How does the mix perform, and where?", visuals: ["Growth heatmap: category x market", "Range sunburst", "Channel to category Sankey", "Risers and fallers"] },
  { label: "Stores", href: "/stores", icon: IconBuildingStore, question: "Which stores convert and earn their space?", visuals: ["Visitor to basket funnel", "Footfall vs conversion scatter", "Sortable store league table", "Weekday x period footfall heatmap"] },
  { label: "Digital", href: "/digital", icon: IconDeviceDesktop, question: "How does the website trade and convert?", visuals: ["Stacked area of sessions by device", "Sessions and conversion by device", "Conversion heatmap: market x device", "Browser share"] },
  { label: "Customers", href: "/customers", icon: IconUsers, question: "How do people shop with us?", visuals: ["Basket size histogram with share of sales", "Spend per basket: market x channel dot plot", "Multi-item baskets over time", "Return rate by category (radial bars)"] },
  { label: "Margins", href: "/margins", icon: IconPercentage, question: "Where does the money go?", visuals: ["Store P&L waterfall", "Sales and margin by discount band", "Store contribution box plot", "Product group x period margin matrix"] },
  { label: "Forecasting", href: "/forecasting", icon: IconTrendingUp, question: "Will we hit target?", visuals: ["Cumulative actual and projection with a range band", "Projected target achievement gauge", "Period by period projection table"] },
];

export const FOOTER_ITEMS: NavItem[] = [
  { label: "Reports", href: "/reports", icon: IconFileText, question: "Every page and what it answers", visuals: ["This index"] },
  { label: "Data", href: "/data", icon: IconDatabase, question: "Can I trust the numbers?", visuals: ["Data quality score and status", "Checks by category", "Reconciliations", "Table freshness", "Every check and its result"] },
];

export function navItemFor(pathname: string): NavItem | undefined {
  return [...NAV_ITEMS, ...FOOTER_ITEMS].find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );
}