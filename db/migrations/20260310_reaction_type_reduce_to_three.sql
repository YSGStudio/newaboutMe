create type reaction_type_v2 as enum ('heart', 'hug', 'fighting');

alter table feed_reactions
  alter column reaction_type type reaction_type_v2
  using (
    case reaction_type::text
      when 'thumbsup' then 'heart'
      else reaction_type::text
    end::reaction_type_v2
  );

drop type reaction_type;
alter type reaction_type_v2 rename to reaction_type;
