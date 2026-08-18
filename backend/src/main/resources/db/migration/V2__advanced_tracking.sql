create table application_event (
    id uuid primary key,
    application_id uuid not null references job_application(id) on delete cascade,
    event_type varchar(50) not null,
    title varchar(180) not null,
    details text not null default '',
    created_at timestamptz not null
);

create index idx_application_event_application_created on application_event(application_id, created_at desc);

create table follow_up (
    id uuid primary key,
    application_id uuid not null references job_application(id) on delete cascade,
    scheduled_for date not null,
    status varchar(30) not null,
    completed_at timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create index idx_follow_up_application on follow_up(application_id, scheduled_for desc);
create index idx_follow_up_status_date on follow_up(status, scheduled_for);

insert into follow_up(id, application_id, scheduled_for, status, completed_at, created_at, updated_at)
select gen_random_uuid(), id, follow_up_date,
       case when follow_up_date < current_date then 'OVERDUE'
            when follow_up_date = current_date then 'DUE'
            else 'PLANNED' end,
       null, last_updated, last_updated
from job_application
where follow_up_date is not null;

create table interview_debrief (
    id uuid primary key,
    interview_id uuid not null unique references interview(id) on delete cascade,
    sentiment varchar(30) not null,
    questions text not null default '',
    strengths text not null default '',
    improvements text not null default '',
    next_action text not null default '',
    updated_at timestamptz not null
);
