import { ComingSoon } from "@/components/layout/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      round={2}
      visuals={[
        "P&L waterfall from turnover to net contribution",
        "Margin by discount band: bar and line",
        "Box plot: net contribution % by store type",
        "Margin matrix: product group x period",
      ]}
    />
  );
}