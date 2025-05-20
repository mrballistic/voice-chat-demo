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
