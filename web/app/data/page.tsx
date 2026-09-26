import { ComingSoon } from "@/components/layout/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      round={3}
      visuals={[
        "Data quality score and status",
        "Every check with its result",
        "Table freshness and profile",
      ]}
    />
  );
}