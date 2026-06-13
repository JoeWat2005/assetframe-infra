import type { Metadata } from "next";
import { getCatalog } from "@/lib/content";
import { Hero } from "@/components/ui";
import ReportsBrowser from "@/components/ReportsBrowser";

export const metadata: Metadata = { title: "Reports" };

// Catalog changes only when an edition is published — cache + background-revalidate.
export const revalidate = 300;

export default async function ReportsPage() {
  const editions = await getCatalog();
  return (
    <>
      <Hero title="Reports" tag="Free Snapshots open instantly. Pro reports unlock with a subscription." />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-5">
        {editions.length === 0 ? (
          <p className="text-sm text-muted">No editions published yet.</p>
        ) : (
          <ReportsBrowser editions={editions} />
        )}
      </div>
    </>
  );
}
