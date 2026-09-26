import { ComingSoon } from "@/components/layout/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      round={2}
      visuals={[
        "Pareto: bar + cumulative line of style sales",
        "Bubble scatter: price vs units, sized by sales",
        "Best and worst sellers table with images and sparklines",
        "Treemap: brand into product group",
      ]}
    />
  );
}