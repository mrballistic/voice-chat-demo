import { ChatInterface } from "@/components/chat-interface";
import { Lora } from "next/font/google";
import Image from 'next/image';
import "@/app/globals.css";

const lora = Lora({
  weight: "700",
  style: "italic",
  subsets: ["latin"],
});

export default function Home() {
  return (
    <>
      <div className="left-accent-bar" />
      <div className="min-h-screen flex flex-col font-[family-name:var(--font-inter)] bg-[#002078]">
        <main className="flex flex-col gap-8 items-center w-[80vw] max-w-7xl px-2 sm:px-6 xl:px-8 flex-1">
          <h1 className={`text-5xl font-bold text-center w-full flex justify-center mb-6 text-[#d9ff44] ${lora.className}`}>
           ✨Dr. Forrester&#8217;s Intake Voice Bot✨
          </h1>
          <ChatInterface />
        </main>
        {/* Footer absolutely positioned flush right with the browser window */}
        <footer className="fixed right-0 bottom-0 pb-4 pr-6 z-50">
          <Image
            src="/logos.png"
            alt="Logos"
            width={220}
            height={70}
            className="w-56 h-auto opacity-90"
            draggable={false}
            priority
          />
        </footer>
      </div>
    </>
  );
}
