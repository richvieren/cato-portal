import { Context, SessionFlavor } from 'grammy';

export interface SessionData {
  awaitingEmail?: boolean;
  source?: string;
  pendingLesson?: {
    courseId: string;
    lessonNumber: number;
    title: string;
    step: 'awaiting_text' | 'awaiting_voice' | 'awaiting_image' | 'done';
    bodyText?: string;
    voiceNoteUrl?: string;
    imageUrl?: string;
  };
}

export type BotContext = Context & SessionFlavor<SessionData>;
