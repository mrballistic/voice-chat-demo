import { ChatInterface } from "@/components/chat-interface";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <h1 className="text-3xl font-bold text-center mb-6">
         ✨ Voice Chat with OpenAI ✨
        </h1>
        <ChatInterface />
      </main>
     
    </div>
  );
}
