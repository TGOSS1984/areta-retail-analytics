import { ComingSoon } from "@/components/layout/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      round={3}
      visuals={[
        "Actual and projected sales to year end, with a range band",
        "Gauge: projected target achievement",
        "Period-by-period projection table",
      ]}
    />
  );
}