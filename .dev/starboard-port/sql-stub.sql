create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create table teacher_profiles (id uuid primary key default gen_random_uuid(), name text not null, role text default 'general');
create table classes (id uuid primary key default gen_random_uuid(), teacher_id uuid not null references teacher_profiles(id) on delete cascade, class_name text);
create table students (id uuid primary key default gen_random_uuid(), class_id uuid not null references classes(id) on delete cascade, name text not null, student_number int not null, unique(class_id, student_number), unique(class_id, name));
grant usage on schema public to service_role; grant all on all tables in schema public to service_role;
