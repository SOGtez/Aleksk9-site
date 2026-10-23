import { Meta } from "@once-ui-system/core";
import { baseURL } from "@/resources";
import { PrintSheets } from "@/components/awards/PrintSheets";

export async function generateMetadata() {
  const m = Meta.generate({ title: "AK9 Awards · Winner sheets", description: "Printable AK9 Awards winner sheets.", baseURL, path: "/awards/print", image: "/og-image.png" });
  return { ...m, robots: { index: false, follow: false } };
}

export default function AwardsPrint() {
  return <PrintSheets />;
}
