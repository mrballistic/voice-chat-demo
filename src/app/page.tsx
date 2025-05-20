import { ChatInterface } from "@/components/chat-interface";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] items-center sm:items-start w-full max-w-2xl px-4">
        <h1 className="text-3xl font-bold text-center w-full flex justify-center mb-6">
         ✨ Voice Chat with OpenAI ✨
        </h1>
        <ChatInterface />
      </main>
    </div>
  );
}
