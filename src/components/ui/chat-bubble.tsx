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
        'max-w-[80%] relative p-4 mb-2',
        isUser
          ? 'bg-primary text-primary-foreground ml-auto rounded-2xl'
          : 'bg-muted mr-auto rounded-2xl',
        className
      )}
      aria-live="polite"
      aria-label={isUser ? 'User message' : 'AI message'}
      role="region"
    >
      <p className="break-words whitespace-pre-line">{content}</p>
      {/* Custom CSS triangle tail for speech balloon, flush with edge and near top */}
      <span
        className={
          'absolute ' +
          (isUser
            ? 'right-[-6px] top-[14px] w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-l-8 border-l-primary'
            : 'left-[-6px] top-[14px] w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-muted')
        }
        aria-hidden="true"
      />
    </div>
  );
}
