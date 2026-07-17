import fetch from 'node-fetch';

const SUPABASE_URL = "https://nqzpoioxvbqavrtphtoa.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xenBvaW94dmJxYXZydHBodG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMyNDgsImV4cCI6MjA5MDgxOTI0OH0.G1VlS8doiHQtooC2tyiiHbWl4h9kqoMSuirShDhhjzk";

async function main() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      'apikey': SUPABASE_PUBLISHABLE_KEY,
      'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
    }
  });
  const json = await res.json();
  console.log("JSON response keys:", Object.keys(json));
  if (json.definitions) {
    console.log("Definitions (tables):", Object.keys(json.definitions));
  } else {
    console.log("Entire response:", json);
  }
}

main().catch(err => console.error(err));
