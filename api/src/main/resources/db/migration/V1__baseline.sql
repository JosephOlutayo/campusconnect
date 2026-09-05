-- CampusConnect baseline schema (PostgreSQL).
--
-- Generated from the JPA entities, which stay the source of truth for the
-- shape of the data. From here on the database is changed by adding a new
-- V<n>__ file, never by editing this one and never by letting Hibernate alter
-- a live schema: ddl-auto is `validate` in production, so a drift between
-- these migrations and the entities stops the application from starting
-- rather than being discovered later as missing data.
--
-- Applying this to an existing database that Hibernate already created:
--   set  spring.flyway.baseline-on-migrate=true
-- so Flyway records the schema as already at V1 instead of trying to
-- recreate it.

create table availability_rules (
        end_minute integer not null,
        start_minute integer not null,
        day_of_week varchar(12) not null check (day_of_week in ('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY')),
        id uuid not null,
        provider_id uuid not null,
        primary key (id)
    );

    create table bookings (
        platform_fee_cents integer not null,
        price_cents integer not null,
        provider_payout_cents integer not null,
        block_end_at timestamp(6) not null,
        cancelled_at timestamp(6) with time zone,
        completed_at timestamp(6) with time zone,
        confirmed_at timestamp(6) with time zone,
        created_at timestamp(6) with time zone not null,
        end_at timestamp(6) not null,
        start_at timestamp(6) not null,
        code varchar(12) not null unique,
        cancelled_by_user_id uuid,
        customer_id uuid not null,
        id uuid not null,
        provider_id uuid not null,
        service_id uuid not null,
        location_mode varchar(20) not null check (location_mode in ('AT_PROVIDER','AT_CUSTOMER','ONLINE')),
        status varchar(20) not null check (status in ('PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW')),
        location_label varchar(200) not null,
        cancellation_reason varchar(400),
        customer_note varchar(600),
        primary key (id)
    );

    create table categories (
        active boolean not null,
        sort_order integer not null,
        icon varchar(12) not null,
        id uuid not null,
        color varchar(20) not null,
        name varchar(80) not null,
        slug varchar(80) not null unique,
        description varchar(300) not null,
        primary key (id)
    );

    create table category_keywords (
        category_id uuid not null,
        keyword varchar(60) not null,
        primary key (category_id, keyword)
    );

    create table conversations (
        created_at timestamp(6) with time zone not null,
        last_message_at timestamp(6) with time zone not null,
        customer_id uuid not null,
        id uuid not null,
        provider_id uuid not null,
        primary key (id),
        constraint uq_conversation_pair unique (customer_id, provider_id)
    );

    create table email_verification_tokens (
        consumed_at timestamp(6) with time zone,
        created_at timestamp(6) with time zone not null,
        expires_at timestamp(6) with time zone not null,
        id uuid not null,
        user_id uuid not null,
        purpose varchar(20) not null check (purpose in ('CONFIRM_CURRENT','CHANGE_TO')),
        token_hash varchar(64) not null unique,
        sent_to varchar(190) not null,
        primary key (id)
    );

    create table favorites (
        created_at timestamp(6) with time zone not null,
        id uuid not null,
        provider_id uuid not null,
        user_id uuid not null,
        primary key (id),
        constraint uq_favorite unique (user_id, provider_id)
    );

    create table messages (
        created_at timestamp(6) with time zone not null,
        read_at timestamp(6) with time zone,
        booking_id uuid,
        conversation_id uuid not null,
        id uuid not null,
        sender_id uuid not null,
        image_seed varchar(80),
        body varchar(4000) not null,
        primary key (id)
    );

    create table notifications (
        created_at timestamp(6) with time zone not null,
        read_at timestamp(6) with time zone,
        id uuid not null,
        user_id uuid not null,
        type varchar(32) not null check (type in ('BOOKING_CREATED','BOOKING_CONFIRMED','BOOKING_DECLINED','BOOKING_CANCELLED','BOOKING_RESCHEDULED','BOOKING_REMINDER','BOOKING_COMPLETED','MESSAGE_RECEIVED','REVIEW_RECEIVED','REVIEW_REPLY','PROVIDER_APPROVED','PROVIDER_REJECTED','PAYOUT_PAID')),
        title varchar(200) not null,
        href varchar(300),
        body varchar(600) not null,
        primary key (id)
    );

    create table payments (
        amount_cents integer not null,
        platform_fee_cents integer not null,
        provider_amount_cents integer not null,
        captured_at timestamp(6) with time zone,
        created_at timestamp(6) with time zone not null,
        currency varchar(8) not null,
        refunded_at timestamp(6) with time zone,
        booking_id uuid not null unique,
        gateway varchar(16) not null,
        id uuid not null,
        status varchar(24) not null check (status in ('REQUIRES_CAPTURE','SUCCEEDED','REFUNDED','FAILED')),
        external_id varchar(120),
        primary key (id)
    );

    create table platform_settings (
        updated_at timestamp(6) with time zone not null,
        setting_key varchar(80) not null,
        setting_value varchar(500) not null,
        primary key (setting_key)
    );

    create table portfolio_images (
        sort_order integer not null,
        created_at timestamp(6) with time zone not null,
        id uuid not null,
        provider_id uuid not null,
        service_id uuid,
        seed varchar(120) not null,
        caption varchar(200),
        url varchar(500),
        primary key (id)
    );

    create table promotions (
        active boolean not null,
        discount_value integer not null,
        max_redemptions integer,
        redemptions integer not null,
        created_at timestamp(6) with time zone not null,
        ends_at timestamp(6) not null,
        starts_at timestamp(6) not null,
        discount_type varchar(12) not null check (discount_type in ('PERCENT','AMOUNT')),
        id uuid not null,
        provider_id uuid not null,
        code varchar(30) not null,
        description varchar(200) not null,
        primary key (id),
        constraint uq_promotion_code unique (provider_id, code)
    );

    create table provider_location_modes (
        provider_id uuid not null,
        mode varchar(20) not null check (mode in ('AT_PROVIDER','AT_CUSTOMER','ONLINE')),
        primary key (provider_id, mode)
    );

    create table provider_profiles (
        auto_confirm_bookings boolean not null,
        buffer_minutes integer not null,
        completed_bookings integer not null,
        latitude float(53) not null,
        longitude float(53) not null,
        max_advance_days integer not null,
        min_notice_minutes integer not null,
        rating_avg float(53) not null,
        rating_count integer not null,
        verified boolean not null,
        created_at timestamp(6) with time zone not null,
        id uuid not null,
        university_id uuid not null,
        user_id uuid not null unique,
        status varchar(20) not null check (status in ('ACTIVE','PAUSED','PENDING','REJECTED','SUSPENDED')),
        business_name varchar(120) not null,
        stripe_account_id varchar(120),
        location_label varchar(160) not null,
        tagline varchar(160),
        exact_address varchar(250),
        cancellation_policy varchar(600) not null,
        bio varchar(4000) not null,
        primary key (id)
    );

    create table reports (
        created_at timestamp(6) with time zone not null,
        resolved_at timestamp(6) with time zone,
        id uuid not null,
        reporter_id uuid not null,
        status varchar(16) not null check (status in ('OPEN','REVIEWING','RESOLVED','DISMISSED')),
        target_id uuid not null,
        target_user_id uuid,
        target_type varchar(20) not null,
        reason varchar(120) not null,
        resolution_note varchar(1000),
        details varchar(2000),
        primary key (id)
    );

    create table reviews (
        hidden boolean not null,
        rating integer not null,
        created_at timestamp(6) with time zone not null,
        provider_responded_at timestamp(6) with time zone,
        author_id uuid not null,
        booking_id uuid not null unique,
        id uuid not null,
        provider_id uuid not null,
        provider_response varchar(1200),
        body varchar(2000) not null,
        primary key (id)
    );

    create table service_location_modes (
        service_id uuid not null,
        mode varchar(20) not null check (mode in ('AT_PROVIDER','AT_CUSTOMER','ONLINE')),
        primary key (service_id, mode)
    );

    create table service_offerings (
        active boolean not null,
        booking_count integer not null,
        duration_minutes integer not null,
        price_cents integer not null,
        created_at timestamp(6) with time zone not null,
        category_id uuid not null,
        id uuid not null,
        provider_id uuid not null,
        title varchar(140) not null,
        description varchar(2000) not null,
        primary key (id)
    );

    create table time_off (
        created_at timestamp(6) with time zone not null,
        end_at timestamp(6) not null,
        start_at timestamp(6) not null,
        id uuid not null,
        provider_id uuid not null,
        reason varchar(200),
        primary key (id)
    );

    create table universities (
        active boolean not null,
        latitude float(53) not null,
        longitude float(53) not null,
        created_at timestamp(6) with time zone not null,
        id uuid not null,
        color varchar(20) not null,
        short_name varchar(40) not null,
        state varchar(40) not null,
        slug varchar(80) not null unique,
        city varchar(255) not null,
        name varchar(255) not null,
        primary key (id)
    );

    create table university_email_domains (
        university_id uuid not null,
        domain varchar(120) not null,
        primary key (university_id, domain),
        unique (domain)
    );

    create table users (
        suspended boolean not null,
        created_at timestamp(6) with time zone not null,
        email_verified_at timestamp(6) with time zone,
        student_verified_at timestamp(6) with time zone,
        id uuid not null,
        university_id uuid,
        role varchar(20) not null check (role in ('STUDENT','PROVIDER','ADMIN')),
        phone varchar(40),
        avatar_seed varchar(80) not null,
        name varchar(120) not null,
        email varchar(190) not null unique,
        suspended_note varchar(400),
        bio varchar(600),
        password_hash varchar(255) not null,
        primary key (id)
    );

    create index idx_availability_provider
       on availability_rules (provider_id);

    create index idx_availability_provider_day
       on availability_rules (provider_id, day_of_week);

    create index idx_booking_customer
       on bookings (customer_id);

    create index idx_booking_provider
       on bookings (provider_id);

    create index idx_booking_start
       on bookings (start_at);

    create index idx_booking_provider_window
       on bookings (provider_id, start_at);

    create index idx_booking_provider_status
       on bookings (provider_id, status);

    create index idx_category_slug
       on categories (slug);

    create index idx_conversation_customer
       on conversations (customer_id);

    create index idx_conversation_provider
       on conversations (provider_id);

    create index idx_conversation_recent
       on conversations (last_message_at);

    create index idx_evt_token_hash
       on email_verification_tokens (token_hash);

    create index idx_favorite_user
       on favorites (user_id);

    create index idx_message_conversation
       on messages (conversation_id);

    create index idx_message_thread_order
       on messages (conversation_id, created_at);

    create index idx_message_sender
       on messages (sender_id);

    create index idx_notification_user
       on notifications (user_id);

    create index idx_notification_unread
       on notifications (user_id, read_at);

    create index idx_payment_status
       on payments (status);

    create index idx_portfolio_provider
       on portfolio_images (provider_id);

    create index idx_portfolio_service
       on portfolio_images (service_id);

    create index idx_promotion_provider
       on promotions (provider_id);

    create index idx_provider_university
       on provider_profiles (university_id);

    create index idx_provider_status
       on provider_profiles (status);

    create index idx_provider_rating
       on provider_profiles (rating_avg);

    create index idx_report_status
       on reports (status);

    create index idx_report_target_user
       on reports (target_user_id);

    create index idx_review_provider
       on reviews (provider_id);

    create index idx_review_author
       on reviews (author_id);

    create index idx_review_visible
       on reviews (provider_id, hidden);

    create index idx_service_provider
       on service_offerings (provider_id);

    create index idx_service_category
       on service_offerings (category_id);

    create index idx_service_active
       on service_offerings (active);

    create index idx_timeoff_provider
       on time_off (provider_id);

    create index idx_timeoff_window
       on time_off (provider_id, start_at);

    create index idx_university_slug
       on universities (slug);

    create index idx_university_active
       on universities (active);

    create index idx_user_email
       on users (email);

    create index idx_user_university
       on users (university_id);

    create index idx_user_role
       on users (role);

    alter table if exists availability_rules
       add constraint FK1fsbxelrtm6dg21jevxyk1yps
       foreign key (provider_id)
       references provider_profiles;

    alter table if exists bookings
       add constraint FKib6gjgj2e9binkktxmm175bmm
       foreign key (customer_id)
       references users;

    alter table if exists bookings
       add constraint FKtmuymbx6nj0bjb7jqgfn9o56h
       foreign key (provider_id)
       references provider_profiles;

    alter table if exists bookings
       add constraint FK3vppunevj5l2ycbpqif2jmhf1
       foreign key (service_id)
       references service_offerings;

    alter table if exists category_keywords
       add constraint FKfgbwnrml3r32gg9jgppr1uubg
       foreign key (category_id)
       references categories;

    alter table if exists conversations
       add constraint FKaim02rk3jmh6iu2532wid9ukn
       foreign key (customer_id)
       references users;

    alter table if exists conversations
       add constraint FKihk3d183gwdj9eef0op23j6oi
       foreign key (provider_id)
       references provider_profiles;

    alter table if exists email_verification_tokens
       add constraint FKi1c4mmamlb8keqt74k4lrtwhc
       foreign key (user_id)
       references users;

    alter table if exists favorites
       add constraint FK3pn2r7wypdvufuliqfmrt1noh
       foreign key (provider_id)
       references provider_profiles;

    alter table if exists favorites
       add constraint FKk7du8b8ewipawnnpg76d55fus
       foreign key (user_id)
       references users;

    alter table if exists messages
       add constraint FKt492th6wsovh1nush5yl5jj8e
       foreign key (conversation_id)
       references conversations;

    alter table if exists messages
       add constraint FK4ui4nnwntodh6wjvck53dbk9m
       foreign key (sender_id)
       references users;

    alter table if exists notifications
       add constraint FK9y21adhxn0ayjhfocscqox7bh
       foreign key (user_id)
       references users;

    alter table if exists payments
       add constraint FKc52o2b1jkxttngufqp3t7jr3h
       foreign key (booking_id)
       references bookings;

    alter table if exists portfolio_images
       add constraint FKtfaiylxfeskcuea0ipj9p8qo7
       foreign key (provider_id)
       references provider_profiles;

    alter table if exists portfolio_images
       add constraint FKbmqs437f8nbx0ffe8ctgi1td0
       foreign key (service_id)
       references service_offerings;

    alter table if exists promotions
       add constraint FKsmqj960byx6eyuy73alkx9imt
       foreign key (provider_id)
       references provider_profiles;

    alter table if exists provider_location_modes
       add constraint FKg9v8tcboldle7c90nn5ikje4b
       foreign key (provider_id)
       references provider_profiles;

    alter table if exists provider_profiles
       add constraint FKqo8u1w75ciki06k4unwn3ruhu
       foreign key (university_id)
       references universities;

    alter table if exists provider_profiles
       add constraint FKsg72i9r07mvl4th8r2ihxuwg9
       foreign key (user_id)
       references users;

    alter table if exists reports
       add constraint FKd3qiw2om5d2oh5xb7fbdcq225
       foreign key (reporter_id)
       references users;

    alter table if exists reviews
       add constraint FKse5kx11600wtv0jh9jobvrdpi
       foreign key (author_id)
       references users;

    alter table if exists reviews
       add constraint FK28an517hrxtt2bsg93uefugrm
       foreign key (booking_id)
       references bookings;

    alter table if exists reviews
       add constraint FK34m2xmuydjfidk0o8rtcfllqs
       foreign key (provider_id)
       references provider_profiles;

    alter table if exists service_location_modes
       add constraint FKrebo6c0eldq3bxnu9ish4uxd3
       foreign key (service_id)
       references service_offerings;

    alter table if exists service_offerings
       add constraint FK7fehn3llb8wnb5nhoc5manne4
       foreign key (category_id)
       references categories;

    alter table if exists service_offerings
       add constraint FKoxyib9fm40lwgr0sara047vrd
       foreign key (provider_id)
       references provider_profiles;

    alter table if exists time_off
       add constraint FK3c8jktntewa0uru2dxwpk6eba
       foreign key (provider_id)
       references provider_profiles;

    alter table if exists university_email_domains
       add constraint FKryabjhfijfjvy886s4420c29n
       foreign key (university_id)
       references universities;

    alter table if exists users
       add constraint FKm6cuniuttvvmhstb2s32jsotf
       foreign key (university_id)
       references universities;
