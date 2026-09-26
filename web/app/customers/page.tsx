import { ComingSoon } from "@/components/layout/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      round={3}
      visuals={[
        "Basket-size histogram from the invoice lines",
        "Average transaction value by channel and market",
        "Multi-buy share over time",
        "Returns rate by category",
      ]}
    />
  );
}