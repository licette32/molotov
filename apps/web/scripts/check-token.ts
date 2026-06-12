import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(import.meta.dirname, '../../../.env') })
import { createClient } from '@supabase/supabase-js'

const TOKEN_ID = Number(process.argv[2] ?? '7')

async function main() {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })
  const [{ data: token, error: te }, { data: cursor }] = await Promise.all([
    db.from('tokens').select('*').eq('token_id', TOKEN_ID).single(),
    db.from('indexer_cursor').select('last_ledger, last_cursor').eq('id', 1).single(),
  ])
  console.log(`token#${TOKEN_ID}:`, JSON.stringify(token, null, 2))
  console.log('cursor:', JSON.stringify(cursor, null, 2))
  if (te) console.error('error:', te.message)
}

main().catch(err => { console.error(err); process.exit(1) })
