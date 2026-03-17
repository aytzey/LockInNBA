import HomePageClient from "@/components/HomePageClient";
import { getHomepageBootstrap } from "@/lib/homepage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const initialData = await getHomepageBootstrap();

  return <HomePageClient initialData={initialData} />;
}
