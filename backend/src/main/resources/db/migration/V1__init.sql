create table app_user (
    id uuid primary key,
    email varchar(320) not null unique,
    password_hash varchar(100) not null,
    display_name varchar(120) not null,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create table user_profile (
    user_id uuid primary key references app_user(id) on delete cascade,
    headline varchar(180) not null default '',
    experience_label varchar(120) not null default '',
    location varchar(180) not null default '',
    summary text not null default '',
    education varchar(240) not null default '',
    target_compensation varchar(120) not null default '',
    updated_at timestamptz not null
);

create table user_profile_skill (
    user_id uuid not null references user_profile(user_id) on delete cascade,
    skill varchar(120) not null,
    skill_order integer not null,
    primary key (user_id, skill_order)
);

create table user_profile_certification (
    user_id uuid not null references user_profile(user_id) on delete cascade,
    certification varchar(180) not null,
    certification_order integer not null,
    primary key (user_id, certification_order)
);

create table job_application (
    id uuid primary key,
    user_id uuid not null references app_user(id) on delete cascade,
    company varchar(180) not null,
    position varchar(220) not null,
    application_date date not null,
    status varchar(40) not null,
    notes text not null default '',
    last_updated timestamptz not null,
    response_date date,
    offer_url text,
    contract_type varchar(40) not null,
    salary_target numeric(14,2),
    salary_period varchar(40) not null,
    follow_up_date date,
    recruiter_name varchar(180),
    recruiter_email varchar(320),
    recruiter_phone varchar(80),
    stage varchar(60) not null,
    priority varchar(30) not null,
    version bigint not null default 0
);

create index idx_job_application_user_date on job_application(user_id, application_date desc);
create index idx_job_application_user_stage on job_application(user_id, stage);
create index idx_job_application_user_follow_up on job_application(user_id, follow_up_date);

create table interview (
    id uuid primary key,
    application_id uuid not null references job_application(id) on delete cascade,
    interview_date timestamptz not null,
    type varchar(40) not null,
    notes text not null default '',
    reminder_set boolean not null default false
);

create index idx_interview_application on interview(application_id);
create index idx_interview_date on interview(interview_date);
