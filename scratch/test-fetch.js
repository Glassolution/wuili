import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://nqzpoioxvbqavrtphtoa.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xenBvaW94dmJxYXZydHBodG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMyNDgsImV4cCI6MjA5MDgxOTI0OH0.G1VlS8doiHQtooC2tyiiHbWl4h9kqoMSuirShDhhjzk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function test() {
  try {
    console.log("Starting test query...");
    const { data, count, error } = await supabase
      .from("catalog_products")
      .select("*", { count: "exact" })
      .in("source", ["cj", "b2drop", "c7drop"])
      .eq("is_blocked", false)
      .gt("stock_quantity", 0)
      .order("created_at", { ascending: false })
      .range(0, 11);

    if (error) {
      console.error("Query Error:", error);
    } else {
      console.log("Query success!");
      console.log("Count:", count);
      console.log("Number of rows returned:", data?.length);
      if (data && data.length > 0) {
        console.log("First product sample:", {
          id: data[0].id,
          title: data[0].title,
          source: data[0].source,
          is_blocked: data[0].is_blocked,
          stock_quantity: data[0].stock_quantity
        });
      }
    }
  } catch (err) {
    console.error("Catch block error:", err);
  }
}

test();
