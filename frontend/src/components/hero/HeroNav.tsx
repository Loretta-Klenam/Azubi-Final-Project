import { useNavigate } from "react-router-dom";

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
        <button
          onClick={() => navigate("/events")}
          className="bg-transparent border-none cursor-pointer font-sans text-[15px] font-semibold uppercase text-[#292929] tracking-[0.04em] transition-opacity hover:opacity-55"
        >
          Discover
        </button>
      </div>

      {/* Right actions — col 3 */}
      <div className="flex items-center justify-end gap-6 lg:gap-8">
        <button
          onClick={() => navigate("/faqs")}
          className="hidden lg:block bg-transparent border-none cursor-pointer font-sans text-[15px] font-semibold uppercase text-[#292929] tracking-[0.04em] transition-opacity hover:opacity-55"
        >
          FAQs
        </button>
      </div>
    </nav>
  );
}
