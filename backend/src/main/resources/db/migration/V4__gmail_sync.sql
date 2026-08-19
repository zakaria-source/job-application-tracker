create table gmail_connection (
    id uuid primary key,
    user_id uuid not null unique references app_user(id) on delete cascade,
    email_address varchar(320) not null,
    refresh_token_ciphertext text not null,
    history_id varchar(64),
    sync_enabled boolean not null default true,
    connected_at timestamptz not null,
    last_sync_at timestamptz,
    last_error varchar(500),
    updated_at timestamptz not null
);

create index idx_gmail_connection_sync on gmail_connection(sync_enabled, last_sync_at);

create table gmail_oauth_state (
    id uuid primary key,
    user_id uuid not null references app_user(id) on delete cascade,
    state_hash varchar(64) not null unique,
    expires_at timestamptz not null,
    created_at timestamptz not null
);

create index idx_gmail_oauth_state_expires on gmail_oauth_state(expires_at);

create table gmail_processed_message (
    id uuid primary key,
    connection_id uuid not null references gmail_connection(id) on delete cascade,
    message_id varchar(128) not null,
    thread_id varchar(128),
    message_date timestamptz,
    processed_at timestamptz not null,
    matched_application_id uuid references job_application(id) on delete set null,
    signal_type varchar(80),
    match_score integer,
    auto_applied boolean not null default false,
    constraint uq_gmail_processed_message unique (connection_id, message_id)
);

create index idx_gmail_processed_connection_date on gmail_processed_message(connection_id, processed_at desc);
