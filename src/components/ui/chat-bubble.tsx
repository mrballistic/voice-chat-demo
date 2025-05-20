// ChatBubble component displays a single chat message as a speech bubble.
// Includes accessibility attributes for screen readers.
import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Props for ChatBubble component.
 * @property content - The message text to display.
 * @property isUser - Whether the message is from the user (true) or AI (false).
 * @property className - Optional additional class names for styling.
 */
interface ChatBubbleProps {
  content: string;
  isUser: boolean;
  className?: string;
}

/**
 * Renders a chat bubble for a message.
 * @param content - The message text.
 * @param isUser - Whether the message is from the user.
 * @param className - Additional class names.
 */
export function ChatBubble({ content, isUser, className }: ChatBubbleProps) {
  return (
    <div
      className={cn(
        'max-w-[80%] rounded-lg p-4 mb-2',
        isUser ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted mr-auto',
        className
      )}
      aria-live="polite"
      aria-label={isUser ? 'User message' : 'AI message'}
      role="region"
    >
      <p className="break-words whitespace-pre-line">{content}</p>
    </div>
  );
}
