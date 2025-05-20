# Technical Brief: Real-Time Voice Chat Frontend with Gemini API

## Project Overview
Create a React-based frontend using Next.js that interfaces with the Gemini Voice API to display real-time voice conversations as text in speech bubbles. The UI will be built with shadcn/ui components and styled with Tailwind CSS.

## Technical Stack
- **Framework**: Next.js (React)
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **API Integration**: Google Gemini Voice API
- **State Management**: React hooks (useState, useEffect, useContext)

## Core Functionality
1. Capture user voice input
2. Stream this to the Gemini Voice API
3. Receive and display the AI's text response in real-time
4. Present the conversation in speech bubbles that update dynamically
5. Maintain conversation history

## Implementation Plan

### Step 1: Set Up Project Environment
1. Create a new Next.js project:
```bash
npx create-next-app@latest voice-chat-demo --typescript
cd voice-chat-demo
```

2. Install required dependencies:
```bash
npm install @google/generative-ai
npm install -D tailwindcss postcss autoprefixer
```

3. Set up shadcn/ui:
```bash
npx shadcn-ui@latest init
```

### Step 2: Configure Gemini API
1. Create a `.env.local` file in the project root:
```
NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
```

2. Create an API utility file at `lib/gemini.ts`:
```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export const geminiModel = genAI.getGenerativeModel({ model: "gemini-pro" });

export async function streamChat(prompt: string) {
  const result = await geminiModel.generateContentStream(prompt);
  return result;
}
```

### Step 3: Create Chat Components
1. Create a `components/ui/chat-bubble.tsx` component:
```typescript
import React from 'react';
import { cn } from '@/lib/utils';

interface ChatBubbleProps {
  content: string;
  isUser: boolean;
  className?: string;
}

export function ChatBubble({ content, isUser, className }: ChatBubbleProps) {
  return (
    <div className={cn(
      "max-w-[80%] rounded-lg p-4 mb-2",
      isUser ? "bg-primary text-primary-foreground ml-auto" : "bg-muted mr-auto",
      className
    )}>
      <p>{content}</p>
    </div>
  );
}
```

2. Create a `components/chat-interface.tsx` component:
```typescript
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChatBubble } from '@/components/ui/chat-bubble';
import { streamChat } from '@/lib/gemini';

interface Message {
  content: string;
  isUser: boolean;
}

export function ChatInterface() {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom when messages update
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, currentResponse]);

  const startRecording = async () => {
    setIsRecording(true);
    // Here you would implement the voice recording logic
    // For now, we'll simulate a user message
    const userMessage = "Hello, how are you today?";
    setMessages(prev => [...prev, { content: userMessage, isUser: true }]);
    
    try {
      const result = await streamChat(userMessage);
      setCurrentResponse('');
      
      // Process the stream
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        setCurrentResponse(prev => prev + chunkText);
      }
      
      // Add completed response to messages
      setMessages(prev => [...prev, { content: currentResponse, isUser: false }]);
      setCurrentResponse('');
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col h-[80vh] max-w-2xl mx-auto border rounded-lg">
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map((message, index) => (
          <ChatBubble 
            key={index}
            content={message.content}
            isUser={message.isUser}
          />
        ))}
        
        {currentResponse && (
          <ChatBubble 
            content={currentResponse}
            isUser={false}
          />
        )}
      </div>
      
      <div className="border-t p-4">
        <Button 
          onClick={startRecording}
          disabled={isRecording}
          className="w-full"
        >
          {isRecording ? 'Listening...' : 'Press to Talk'}
        </Button>
      </div>
    </div>
  );
}
```

### Step 4: Implement Voice Recording
For actual voice recording and streaming, you'll need to implement the Web Audio API:

```typescript
// Add this to chat-interface.tsx

const startRecording = async () => {
  setIsRecording(true);
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks: BlobPart[] = [];
    
    mediaRecorder.addEventListener("dataavailable", event => {
      audioChunks.push(event.data);
    });
    
    mediaRecorder.addEventListener("stop", async () => {
      const audioBlob = new Blob(audioChunks);
      // Here you would send this audio to a speech-to-text service
      // Then send the text to Gemini API
      
      // For now, simulate with a fixed message
      const userMessage = "Hello, how are you today?";
      setMessages(prev => [...prev, { content: userMessage, isUser: true }]);
      
      // Process with Gemini API as shown before
      // ...
    });
    
    mediaRecorder.start();
    
    // Stop recording after 5 seconds (for demo)
    setTimeout(() => {
      mediaRecorder.stop();
      stream.getTracks().forEach(track => track.stop());
    }, 5000);
    
  } catch (error) {
    console.error('Error accessing microphone:', error);
    setIsRecording(false);
  }
};
```

### Step 5: Integrate in Main Page
Update `app/page.tsx`:

```typescript
import { ChatInterface } from '@/components/chat-interface';

export default function Home() {
  return (
    <main className="container mx-auto py-10">
      <h1 className="text-3xl font-bold text-center mb-6">
        Voice Chat with Gemini AI
      </h1>
      <ChatInterface />
    </main>
  );
}
```

## Next Steps

1. **API Integration**: Complete the integration with Gemini Voice API, including proper authentication and error handling.

2. **Voice Recording**: Implement the Web Audio API to capture and process user voice input.

3. **Speech-to-Text**: Either use a browser-based solution or integrate with a service like Google's Speech-to-Text API.

4. **Streaming Response**: Ensure the AI responses appear in real-time as they're generated.

5. **UI Refinements**: Add loading states, error handling, and visual polish to the chat interface.

6. **Accessibility**: Ensure the application is accessible, with proper ARIA attributes and keyboard navigation.

This implementation provides a foundation for your real-time voice chat demo. As you progress, you'll need to refine the voice capture and processing components to achieve a truly real-time experience.