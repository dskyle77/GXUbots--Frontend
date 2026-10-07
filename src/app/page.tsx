import { BotTypes } from "../components/BotTypes";
import { CTA } from "../components/CTA";
import { Hero } from "../components/Hero";
import { HowItWorks } from "../components/HowItWorks";
export default function HomePage() {
  return (
    <>
      <Hero />
      <BotTypes/>
      <HowItWorks/>
      <CTA/>
    </>
  );
}
