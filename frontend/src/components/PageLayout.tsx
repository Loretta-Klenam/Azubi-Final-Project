import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  scrim?: "default" | "light";
}

export default function PageLayout({ children, scrim = "default" }: Props) {
  return (
    <div className="page-shell">
      <video
        className="page-video"
        src="https://pollen-batch-41236914.figma.site/_components/v2/f0ee2dae7671c170c34f12e31c4cb41418976c98/769c564298c132f7919405cd9f17c1b1231f341d.769c5642.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className={scrim === "light" ? "page-scrim page-scrim--light" : "page-scrim"} />
      <main className="page">{children}</main>
    </div>
  );
}