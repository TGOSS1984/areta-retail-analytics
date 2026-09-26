import { ComingSoon } from "@/components/layout/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      round={2}
      visuals={[
        "Matrix heatmap: product group x market, YoY %",
        "Sunburst: division into product group",
        "Sankey: how each channel's sales flow into categories",
      ]}
    />
  );
}