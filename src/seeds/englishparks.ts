import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Seed data for englishparks.in.th — demo client
 * Represents the March 2026 AI Overview snapshot from the screenshot
 */
export async function seedEnglishParks(supabase: SupabaseClient) {
  console.log('🌱 Seeding englishparks.in.th...')

  // 1. Create client
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .upsert({
      name: 'English Parks',
      domain: 'englishparks.in.th',
      slug: 'englishparks',
      kpi_keyword_target: 90,
      is_active: true,
    }, { onConflict: 'slug' })
    .select()
    .single()

  if (clientErr) throw clientErr
  console.log('✅ Client created:', client.id)

  // 2. Create URLs (8 published + 10 pending)
  const urlsData = [
    // Published URLs
    { url: 'https://englishparks.in.th/prefix-suffix/', label: 'Prefix Suffix', ahrefs_fetch_limit: 30, sort_order: 1 },
    { url: 'https://englishparks.in.th/verb-tense/', label: 'Verb Tense', ahrefs_fetch_limit: 30, sort_order: 2 },
    { url: 'https://englishparks.in.th/adjective/', label: 'Adjective', ahrefs_fetch_limit: 30, sort_order: 3 },
    { url: 'https://englishparks.in.th/adverb/', label: 'Adverb', ahrefs_fetch_limit: 30, sort_order: 4 },
    { url: 'https://englishparks.in.th/conjunction/', label: 'Conjunction', ahrefs_fetch_limit: 30, sort_order: 5 },
    { url: 'https://englishparks.in.th/preposition/', label: 'Preposition', ahrefs_fetch_limit: 30, sort_order: 6 },
    { url: 'https://englishparks.in.th/noun/', label: 'Noun', ahrefs_fetch_limit: 30, sort_order: 7 },
    { url: 'https://englishparks.in.th/pronoun/', label: 'Pronoun', ahrefs_fetch_limit: 30, sort_order: 8 },
    // Pending URLs
    { url: 'https://englishparks.in.th/past-perfect/', label: 'Past Perfect', ahrefs_fetch_limit: 30, sort_order: 9 },
    { url: 'https://englishparks.in.th/present-perfect/', label: 'Present Perfect', ahrefs_fetch_limit: 30, sort_order: 10 },
    { url: 'https://englishparks.in.th/future-tense/', label: 'Future Tense', ahrefs_fetch_limit: 30, sort_order: 11 },
    { url: 'https://englishparks.in.th/article/', label: 'Article', ahrefs_fetch_limit: 30, sort_order: 12 },
    { url: 'https://englishparks.in.th/interjection/', label: 'Interjection', ahrefs_fetch_limit: 30, sort_order: 13 },
    { url: 'https://englishparks.in.th/determiner/', label: 'Determiner', ahrefs_fetch_limit: 30, sort_order: 14 },
    { url: 'https://englishparks.in.th/active-passive/', label: 'Active Passive', ahrefs_fetch_limit: 30, sort_order: 15 },
    { url: 'https://englishparks.in.th/indirect-speech/', label: 'Indirect Speech', ahrefs_fetch_limit: 30, sort_order: 16 },
    { url: 'https://englishparks.in.th/conditionals/', label: 'Conditionals', ahrefs_fetch_limit: 30, sort_order: 17 },
    { url: 'https://englishparks.in.th/gerund/', label: 'Gerund', ahrefs_fetch_limit: 30, sort_order: 18 },
  ]

  const { data: urls, error: urlsErr } = await supabase
    .from('client_urls')
    .upsert(
      urlsData.map(u => ({ ...u, client_id: client.id })),
      { onConflict: 'client_id,url' }
    )
    .select()

  if (urlsErr) throw urlsErr
  console.log('✅ URLs created:', urls.length)

  // 3. Create March 2026 snapshot
  const snapshotDate = '2026-03-01'
  const { data: snapshot, error: snapErr } = await supabase
    .from('snapshots')
    .upsert({
      client_id: client.id,
      snapshot_date: snapshotDate,
      ahrefs_country: 'TH',
      total_urls: 8,
      total_citations: 37,
      kpi_target: 90,
      notes: 'T0 Baseline — March 2026',
    }, { onConflict: 'client_id,snapshot_date' })
    .select()
    .single()

  if (snapErr) throw snapErr
  console.log('✅ Snapshot created:', snapshot.id)

  // 4. Insert keyword results for published URLs
  const urlMap = Object.fromEntries(urls.map(u => [u.label, u.id]))

  const keywordData = [
    // Prefix Suffix — 15 citations (300% of target 5)
    ...(['prefix คืออะไร', 'suffix คืออะไร', 'prefix suffix ภาษาอังกฤษ', 'prefix ภาษาไทย', 'คำนำหน้าในภาษาอังกฤษ',
         'การใช้ prefix', 'suffix words', 'word formation', 'prefix examples', 'prefix un-',
         'suffix -tion', 'prefix mis-', 'prefix dis-', 'suffix -ness', 'prefix re-'].map((kw, i) => ({
      snapshot_id: snapshot.id, url_id: urlMap['Prefix Suffix'],
      keyword: kw, best_position: i + 1, volume: 800 - i * 30,
      best_position_kind: 'ai_overview', serp_features: ['ai_overview'],
    }))),
    // Verb Tense — 8 citations (160%)
    ...(['tense คืออะไร', 'verb tense ภาษาอังกฤษ', 'past tense', 'present tense', 'future tense',
         'tense 12 ประเภท', 'verb tense examples', 'simple tense'].map((kw, i) => ({
      snapshot_id: snapshot.id, url_id: urlMap['Verb Tense'],
      keyword: kw, best_position: i + 1, volume: 1200 - i * 50,
      best_position_kind: 'ai_overview', serp_features: ['ai_overview'],
    }))),
    // Adjective — 6 citations (120%)
    ...(['adjective คืออะไร', 'คุณศัพท์ภาษาอังกฤษ', 'adjective examples', 'adjective ประเภท',
         'adjective phrases', 'adjective order'].map((kw, i) => ({
      snapshot_id: snapshot.id, url_id: urlMap['Adjective'],
      keyword: kw, best_position: i + 1, volume: 900 - i * 40,
      best_position_kind: 'ai_overview', serp_features: ['ai_overview'],
    }))),
    // Adverb — 4 citations (80% — ขาดอีก 1)
    ...(['adverb คืออะไร', 'กริยาวิเศษณ์', 'adverb examples', 'adverb ประเภท'].map((kw, i) => ({
      snapshot_id: snapshot.id, url_id: urlMap['Adverb'],
      keyword: kw, best_position: i + 2, volume: 700 - i * 30,
      best_position_kind: 'ai_overview', serp_features: ['ai_overview'],
    }))),
    // Conjunction — 2 citations (40% — ขาดอีก 3)
    ...(['conjunction คืออะไร', 'คำเชื่อม ภาษาอังกฤษ'].map((kw, i) => ({
      snapshot_id: snapshot.id, url_id: urlMap['Conjunction'],
      keyword: kw, best_position: i + 1, volume: 600 - i * 20,
      best_position_kind: 'ai_overview', serp_features: ['ai_overview'],
    }))),
    // Preposition — 1 citation (20% — ขาดอีก 4)
    [{ snapshot_id: snapshot.id, url_id: urlMap['Preposition'],
       keyword: 'preposition คืออะไร', best_position: 1, volume: 500,
       best_position_kind: 'ai_overview', serp_features: ['ai_overview'] }][0],
    // Noun — organic only, 0 AI citations
    ...(['noun คืออะไร', 'คำนาม ภาษาอังกฤษ', 'noun ประเภท'].map((kw, i) => ({
      snapshot_id: snapshot.id, url_id: urlMap['Noun'],
      keyword: kw, best_position: i + 3, volume: 1100 - i * 40,
      best_position_kind: 'organic', serp_features: ['ai_overview'],
    }))),
    // Pronoun — organic only, 0 AI citations
    ...(['pronoun คืออะไร', 'สรรพนาม ภาษาอังกฤษ'].map((kw, i) => ({
      snapshot_id: snapshot.id, url_id: urlMap['Pronoun'],
      keyword: kw, best_position: i + 4, volume: 800 - i * 30,
      best_position_kind: 'organic', serp_features: ['ai_overview'],
    }))),
  ]

  const { error: kwErr } = await supabase
    .from('url_keyword_results')
    .upsert(keywordData)

  if (kwErr) throw kwErr
  console.log('✅ Keyword results inserted:', keywordData.length)
  console.log('🎉 Seed complete!')

  return { clientId: client.id, snapshotId: snapshot.id }
}
