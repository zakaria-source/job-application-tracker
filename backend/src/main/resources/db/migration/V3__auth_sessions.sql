create table auth_session (
    id uuid primary key,
    user_id uuid not null references app_user(id) on delete cascade,
    refresh_token_hash varchar(64) not null,
    created_at timestamptz not null,
    expires_at timestamptz not null,
    last_used_at timestamptz not null,
    revoked_at timestamptz
);

create index idx_auth_session_user on auth_session(user_id);
create index idx_auth_session_expires on auth_session(expires_at);
