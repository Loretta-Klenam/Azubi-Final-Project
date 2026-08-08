interface NavButtonProps {
  children: React.ReactNode;
}

export default function NavButton({ children }: NavButtonProps) {
  return (
    <button className="bg-transparent border-none cursor-pointer font-sans text-[15px] font-medium uppercase text-evendor-text tracking-[0.04em] transition-opacity hover:opacity-55">
      {children}
    </button>
  );
}
