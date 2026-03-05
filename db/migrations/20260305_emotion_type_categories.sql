create type emotion_type_v2 as enum (
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
);

alter table emotion_feeds
  alter column emotion_type type emotion_type_v2
  using (
    case emotion_type::text
      when 'joy' then 'joyful'
      when 'sad' then 'sad'
      when 'angry' then 'angry'
      when 'anxious' then 'anxious'
      when 'calm' then 'comfortable'
      when 'thinking' then 'curious'
      when 'excited' then 'passionate'
      when 'tired' then 'bored'
      else 'curious'
    end::emotion_type_v2
  );

drop type emotion_type;
alter type emotion_type_v2 rename to emotion_type;
