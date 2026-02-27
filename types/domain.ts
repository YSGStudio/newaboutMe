export type EmotionType =
  | 'joy'
  | 'sad'
  | 'angry'
  | 'anxious'
  | 'calm'
  | 'thinking'
  | 'excited'
  | 'tired';

export type ReactionType = 'heart' | 'thumbsup' | 'hug' | 'fighting';

export const EMOTION_META: Record<EmotionType, { label: string; emoji: string }> = {
  joy: { label: '기쁨', emoji: '😊' },
  sad: { label: '슬픔', emoji: '😢' },
  angry: { label: '화남', emoji: '😠' },
  anxious: { label: '불안', emoji: '😰' },
  calm: { label: '평온', emoji: '😌' },
  thinking: { label: '고민', emoji: '🤔' },
  excited: { label: '신남', emoji: '😆' },
  tired: { label: '피곤', emoji: '😴' }
};

export const REACTION_META: Record<ReactionType, { label: string; emoji: string }> = {
  heart: { label: '하트', emoji: '❤️' },
  thumbsup: { label: '최고', emoji: '👍' },
  hug: { label: '응원', emoji: '🤗' },
  fighting: { label: '힘내', emoji: '💪' }
};
