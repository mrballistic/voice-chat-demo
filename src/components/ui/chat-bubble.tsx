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
        'max-w-[80%] relative mb-2 flex',
        isUser ? 'justify-end ml-auto' : 'justify-start mr-auto',
        className
      )}
      aria-live="polite"
      aria-label={isUser ? 'User message' : 'AI message'}
      role="region"
    >
      <div
        className={
          'relative px-4 py-2 rounded-2xl text-base shadow-sm ' +
          (isUser
            ? 'ios-bubble-send'
            : 'ios-bubble-receive')
        }
        style={{
          borderBottomRightRadius: isUser ? '0.75rem' : undefined,
          borderBottomLeftRadius: !isUser ? '0.75rem' : undefined,
        }}
      >
        <p className="break-words whitespace-pre-line leading-relaxed">{content}</p>
      </div>
    </div>
  );
}
