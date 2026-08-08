import { Upload } from "lucide-react";
import { useRef } from "react";

export default function PromptCard() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative w-[701px] max-md:w-[calc(100vw-48px)] min-h-[208px] bg-white/[0.06] border-[3px] border-white rounded-[44px] shadow-[0_0_4px_0_rgba(0,0,0,0.15)] overflow-hidden backdrop-blur-[20px]">
      {/* Prompt text */}
      <p className="absolute left-[29px] top-[57px] -translate-y-1/2 w-[609px] max-md:w-[calc(100%-58px)] font-sans text-xl max-md:text-[17px] font-medium text-wandor-prompt leading-relaxed break-words">
        I'm planning a 7-day trip to Japan in October. I love food, hidden
        cafes, scenic hikes, and want to avoid crowds....
      </p>

      {/* Upload button */}
      <button
        aria-label="Upload inspiration"
        onClick={() => fileInputRef.current?.click()}
        className="absolute left-[21px] top-[137px] w-11 h-11 bg-transparent border border-white/70 rounded-full cursor-pointer flex items-center justify-center backdrop-blur-[14px] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
      >
        <Upload className="w-[18px] h-[18px] text-wandor-text flex-shrink-0" />
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
      />

    </div>
  );
}
