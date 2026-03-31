-- Add Ahrefs organic traffic estimate per keyword row (optional display / analysis)

alter table url_keyword_results
  add column if not exists sum_traffic int;

comment on column url_keyword_results.sum_traffic is
  'Ahrefs sum_traffic: estimated monthly organic visits from this keyword (volume_mode affects volume/traffic).';
