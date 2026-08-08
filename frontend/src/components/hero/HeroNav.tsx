import { useNavigate } from "react-router-dom";
import NavButton from "./NavButton";

export default function HeroNav() {
  const navigate = useNavigate();

  return (
    <nav className="grid grid-cols-[1fr_auto_1fr] items-center px-6 pt-5 pb-4 md:px-20 md:pt-6">
      {/* Wordmark — col 1 */}
      <span className="font-display text-[32px] md:text-[40px] text-black leading-none select-none">
        wandor
      </span>

      {/* Center nav links — hidden below lg */}
      <div className="hidden lg:flex gap-8">
        <NavButton>Discover</NavButton>
        <NavButton>Pricing</NavButton>
        <NavButton>FAQs</NavButton>
      </div>

      {/* Right actions — col 3 */}
      <div className="flex items-center justify-end gap-6 lg:gap-8">
        <button
          onClick={() => navigate("/events")}
          className="hidden lg:block bg-transparent border-none cursor-pointer font-sans text-[15px] font-semibold uppercase text-[#292929] tracking-[0.04em] transition-opacity hover:opacity-55"
        >
          Login
        </button>
        <button
          onClick={() => navigate("/events")}
          className="shrink-0 whitespace-nowrap bg-wandor-dark text-[#fafafa] border-none cursor-pointer font-sans text-[15px] font-medium uppercase tracking-[0.04em] px-5 py-3.5 rounded-full transition-all hover:bg-[#333] active:scale-95"
        >
          Plan My Trip
        </button>
      </div>
    </nav>
  );
}
