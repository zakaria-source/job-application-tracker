create table rate_limit_bucket (
    bucket_key varchar(64) primary key,
    window_started_at timestamptz not null,
    expires_at timestamptz not null,
    request_count integer not null,
    constraint ck_rate_limit_request_count_positive check (request_count > 0),
    constraint ck_rate_limit_window_positive check (expires_at > window_started_at)
);

create index idx_rate_limit_bucket_expires on rate_limit_bucket(expires_at);
