export default function HeroBody() {
  return (
    <div className="flex flex-col items-center px-6 pt-16 pb-24 text-center">
      <h1 className="font-sans text-[clamp(40px,6vw,68px)] font-medium text-wandor-text leading-[1.05] tracking-[-0.04em] max-w-[820px] mb-5">
        Where will you go next?
      </h1>
      <p className="font-sans text-xl font-medium text-wandor-muted leading-relaxed max-w-[500px] mb-10">
        Tell our AI where you're going and what you love. We'll create a
        personalized itinerary for you.
      </p>
    </div>
  );
}
