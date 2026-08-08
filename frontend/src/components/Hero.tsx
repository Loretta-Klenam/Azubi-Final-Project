import HeroBody from "./hero/HeroBody";
import HeroNav from "./hero/HeroNav";

export default function Hero() {
  return (
    <section className="relative min-h-svh w-full overflow-hidden">
      {/* Background video */}
      <video
        src="https://pollen-batch-41236914.figma.site/_components/v2/f0ee2dae7671c170c34f12e31c4cb41418976c98/769c564298c132f7919405cd9f17c1b1231f341d.769c5642.mp4"
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* Top white-to-transparent gradient overlay */}
      <div
        className="absolute inset-x-0 top-0 h-[687px] pointer-events-none z-[1]"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)",
        }}
      />

      {/* Content wrapper */}
      <div className="relative z-[2] max-w-[1360px] mx-auto">
        <HeroNav />
        <HeroBody />
      </div>
    </section>
  );
}
