import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { EconomyFlow } from "@/components/economy-flow";
import { ActivityFeed } from "@/components/activity-feed";
import { FeaturedWork } from "@/components/featured-work";
import { Manifesto } from "@/components/manifesto";
import { FinalCta } from "@/components/final-cta";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <div className="relative z-10 flex flex-1 flex-col">
      <Nav />
      <main className="flex flex-1 flex-col">
        <Hero />
        <EconomyFlow />
        <ActivityFeed />
        <FeaturedWork />
        <Manifesto />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
