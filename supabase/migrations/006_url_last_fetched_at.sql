-- Track the most recent Ahrefs pull per URL — even when the fetch returned
-- zero keywords. Lets the dashboard treat a URL as "Published" once it has
-- been attempted at least once, regardless of whether AI Overview keywords
-- were found.

alter table client_urls
  add column if not exists last_fetched_at timestamptz;

comment on column client_urls.last_fetched_at is
  'Timestamp of the most recent Ahrefs Pull for this URL. Set whether the response had keywords or was empty.';

create index if not exists idx_client_urls_last_fetched_at
  on client_urls(client_id, last_fetched_at);
