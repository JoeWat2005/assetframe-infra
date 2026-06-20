import { HeroSkeleton, StatsSkeleton, RowsSkeleton } from "@/components/Skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <HeroSkeleton />
      <div className="mx-auto max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
        <StatsSkeleton n={6} />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[260px] w-full rounded-xl" />
          ))}
        </div>
        <div className="mt-4">
          <RowsSkeleton />
        </div>
      </div>
    </>
  );
}
