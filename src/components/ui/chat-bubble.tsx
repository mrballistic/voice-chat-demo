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
