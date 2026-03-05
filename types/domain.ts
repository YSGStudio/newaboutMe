export const EMOTION_TYPES = [
  'moved',
  'worried',
  'thankful',
  'curious',
  'longing',
  'joyful',
  'surprised',
  'affectionate',
  'flustered',
  'fearful',
  'satisfied',
  'sorry',
  'hateful',
  'trusting',
  'burdened',
  'envious',
  'pitiful',
  'anxious',
  'fulfilled',
  'loving',
  'refreshed',
  'shy',
  'sad',
  'amazed',
  'disappointed',
  'wronged',
  'disgusted',
  'passionate',
  'lonely',
  'depressed',
  'boastful',
  'confident',
  'frustrated',
  'delighted',
  'bored',
  'jealous',
  'irritated',
  'ashamed',
  'comfortable',
  'giving_up',
  'happy',
  'angry',
  'regretful',
  'hopeful'
] as const;

export type EmotionType = (typeof EMOTION_TYPES)[number];

export type EmotionCategoryType =
  | 'joy_vitality'
  | 'affection_bond'
  | 'anxiety_tension'
  | 'sadness_lethargy'
  | 'anger_rejection'
  | 'social_emotions';

export type ReactionType = 'heart' | 'thumbsup' | 'hug' | 'fighting';

export const EMOTION_CATEGORIES: ReadonlyArray<{
  key: EmotionCategoryType;
  label: string;
  emotions: ReadonlyArray<EmotionType>;
}> = [
  {
    key: 'joy_vitality',
    label: '기쁨/활력',
    emotions: ['moved', 'joyful', 'surprised', 'satisfied', 'fulfilled', 'refreshed', 'amazed', 'passionate', 'boastful', 'confident', 'delighted', 'happy', 'hopeful']
  },
  {
    key: 'affection_bond',
    label: '애정/유대',
    emotions: ['thankful', 'longing', 'affectionate', 'trusting', 'loving', 'comfortable']
  },
  {
    key: 'anxiety_tension',
    label: '불안/긴장',
    emotions: ['worried', 'curious', 'flustered', 'fearful', 'burdened', 'anxious', 'shy']
  },
  {
    key: 'sadness_lethargy',
    label: '슬픔/무기력',
    emotions: ['pitiful', 'sad', 'lonely', 'depressed', 'bored', 'giving_up', 'regretful']
  },
  {
    key: 'anger_rejection',
    label: '분노/거부',
    emotions: ['hateful', 'disappointed', 'wronged', 'disgusted', 'frustrated', 'irritated', 'angry']
  },
  {
    key: 'social_emotions',
    label: '사회적 감정',
    emotions: ['sorry', 'envious', 'jealous', 'ashamed']
  }
] as const;

export const EMOTION_META: Record<EmotionType, { label: string; category: EmotionCategoryType; categoryLabel: string }> = {
  moved: { label: '감동', category: 'joy_vitality', categoryLabel: '기쁨/활력' },
  worried: { label: '걱정', category: 'anxiety_tension', categoryLabel: '불안/긴장' },
  thankful: { label: '고마움', category: 'affection_bond', categoryLabel: '애정/유대' },
  curious: { label: '궁금함', category: 'anxiety_tension', categoryLabel: '불안/긴장' },
  longing: { label: '그리움', category: 'affection_bond', categoryLabel: '애정/유대' },
  joyful: { label: '기쁨', category: 'joy_vitality', categoryLabel: '기쁨/활력' },
  surprised: { label: '놀람', category: 'joy_vitality', categoryLabel: '기쁨/활력' },
  affectionate: { label: '다정함', category: 'affection_bond', categoryLabel: '애정/유대' },
  flustered: { label: '당황', category: 'anxiety_tension', categoryLabel: '불안/긴장' },
  fearful: { label: '두려움', category: 'anxiety_tension', categoryLabel: '불안/긴장' },
  satisfied: { label: '만족', category: 'joy_vitality', categoryLabel: '기쁨/활력' },
  sorry: { label: '미안함', category: 'social_emotions', categoryLabel: '사회적 감정' },
  hateful: { label: '미움', category: 'anger_rejection', categoryLabel: '분노/거부' },
  trusting: { label: '믿음', category: 'affection_bond', categoryLabel: '애정/유대' },
  burdened: { label: '부담', category: 'anxiety_tension', categoryLabel: '불안/긴장' },
  envious: { label: '부러움', category: 'social_emotions', categoryLabel: '사회적 감정' },
  pitiful: { label: '불쌍함', category: 'sadness_lethargy', categoryLabel: '슬픔/무기력' },
  anxious: { label: '불안', category: 'anxiety_tension', categoryLabel: '불안/긴장' },
  fulfilled: { label: '뿌듯함', category: 'joy_vitality', categoryLabel: '기쁨/활력' },
  loving: { label: '사랑', category: 'affection_bond', categoryLabel: '애정/유대' },
  refreshed: { label: '상쾌함', category: 'joy_vitality', categoryLabel: '기쁨/활력' },
  shy: { label: '수줍음', category: 'anxiety_tension', categoryLabel: '불안/긴장' },
  sad: { label: '슬픔', category: 'sadness_lethargy', categoryLabel: '슬픔/무기력' },
  amazed: { label: '신기함', category: 'joy_vitality', categoryLabel: '기쁨/활력' },
  disappointed: { label: '실망', category: 'anger_rejection', categoryLabel: '분노/거부' },
  wronged: { label: '억울함', category: 'anger_rejection', categoryLabel: '분노/거부' },
  disgusted: { label: '역겨움', category: 'anger_rejection', categoryLabel: '분노/거부' },
  passionate: { label: '열정', category: 'joy_vitality', categoryLabel: '기쁨/활력' },
  lonely: { label: '외로움', category: 'sadness_lethargy', categoryLabel: '슬픔/무기력' },
  depressed: { label: '우울', category: 'sadness_lethargy', categoryLabel: '슬픔/무기력' },
  boastful: { label: '자랑', category: 'joy_vitality', categoryLabel: '기쁨/활력' },
  confident: { label: '자신감', category: 'joy_vitality', categoryLabel: '기쁨/활력' },
  frustrated: { label: '좌절', category: 'anger_rejection', categoryLabel: '분노/거부' },
  delighted: { label: '즐거움', category: 'joy_vitality', categoryLabel: '기쁨/활력' },
  bored: { label: '지루함', category: 'sadness_lethargy', categoryLabel: '슬픔/무기력' },
  jealous: { label: '질투', category: 'social_emotions', categoryLabel: '사회적 감정' },
  irritated: { label: '짜증', category: 'anger_rejection', categoryLabel: '분노/거부' },
  ashamed: { label: '창피함', category: 'social_emotions', categoryLabel: '사회적 감정' },
  comfortable: { label: '편안함', category: 'affection_bond', categoryLabel: '애정/유대' },
  giving_up: { label: '포기', category: 'sadness_lethargy', categoryLabel: '슬픔/무기력' },
  happy: { label: '행복', category: 'joy_vitality', categoryLabel: '기쁨/활력' },
  angry: { label: '화', category: 'anger_rejection', categoryLabel: '분노/거부' },
  regretful: { label: '후회', category: 'sadness_lethargy', categoryLabel: '슬픔/무기력' },
  hopeful: { label: '희망', category: 'joy_vitality', categoryLabel: '기쁨/활력' }
};

export const REACTION_META: Record<ReactionType, { label: string }> = {
  heart: { label: '하트' },
  thumbsup: { label: '최고' },
  hug: { label: '응원' },
  fighting: { label: '힘내' }
};
