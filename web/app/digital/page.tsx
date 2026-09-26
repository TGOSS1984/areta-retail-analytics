import { ComingSoon } from "@/components/layout/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      round={3}
      visuals={[
        "Stacked area: sessions by device",
        "Bar and line: orders vs conversion by device",
        "Heatmap: conversion by market and device",
        "Browser share bars",
      ]}
    />
  );
}