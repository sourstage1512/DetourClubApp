import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

// Type definitions are unchanged
interface Tag {
  name: string;
}
interface Category {
  name: string;
}
interface Place {
  id: number;
  name: string;
  description: string;
  notes: string;
  neighborhood: string;
  budget_level: string;
  categories: Category;
  tags: Tag[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- User Authentication and Admin Client setup (unchanged) ---
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    if (!serviceKey) throw new Error("SERVICE_ROLE_KEY is not set.");
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceKey
    );

    const { data: profile } = await adminClient
      .from("profiles")
      .select("ai_credits")
      .eq("id", user.id)
      .single();
    if (!profile) throw new Error("Could not retrieve user profile.");

    const AI_CREDIT_COST = 20;
    if (profile.ai_credits < AI_CREDIT_COST) {
      return new Response(
        JSON.stringify({ error: "Insufficient AI credits" }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // --- NEW: The function now accepts hard filters from the app ---
    const { queryText, cityId, selectedCategories } = await req.json();
    if (!queryText || !cityId) {
      throw new Error('Missing "queryText" or "cityId" in the request body.');
    }

    // Step A: Translate category names to category IDs
    let categoryIds: number[] = [];
    if (selectedCategories && selectedCategories.length > 0) {
      const { data: categoriesData, error: categoriesError } = await adminClient
        .from("categories")
        .select("id")
        .in("name", selectedCategories);

      if (categoriesError) throw categoriesError;
      categoryIds = categoriesData.map((c) => c.id);
    }

    // Step B: Build the main query using the translated IDs
    let query = adminClient
      .from("places")
      .select(
        "id, name, description, notes, neighborhood, budget_level, categories (name), tags (name)"
      )
      .eq("city_id", String(cityId))
      .eq("status", "published");

    // Step C: Apply the "hard filter" for categories using the IDs
    if (categoryIds.length > 0) {
      query = query.in("category_id", categoryIds);
    }

    const { data: places, error: placesError } = await query;

    if (placesError) throw placesError;
    if (!places || places.length === 0) {
      // It's not an error if no places match, just return an empty list.
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // The rest of the function now operates on the smaller, pre-filtered list of places
    const placesContext = (places as Place[])
      .map((p: Place) => {
        const tags = p.tags.map((t) => t.name).join(", ");
        return `Place(id: ${p.id}, name: "${p.name}", category: "${p.categories.name}", neighborhood: "${p.neighborhood}", budget_level: "${p.budget_level}", description: "${p.description}", notes: "${p.notes}", tags: [${tags}])`;
      })
      .join("\n");

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY is not set.");

    // --- NEW: The prompt is updated to reflect the pre-filtering ---
    const prompt = `You are a travel discovery assistant for an app called "Detour Club".
    Your task is to act as a powerful ranking engine. I have already pre-filtered a list of places based on the user's hard constraints (like category).
    Your job is to analyze the user's more nuanced request and select the best matches from **this pre-filtered list only**.

    **CRITICAL INSTRUCTION FOR BUDGET:** The 'budget_level' field uses this mapping: '$' = 'Budget', '$$' = 'Balanced', '$$$' = 'Luxury'.

    **User's Nuanced Request:** "${queryText}"

    **Pre-filtered List of Available Places:**
    ${placesContext}

    Based on the user's request, return a JSON object with a single key "place_ids" which is an array of the integer IDs of ALL places from the provided list that are a strong match. Do not limit the number of results. If no places are a strong match, return an empty array.
    `;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!geminiResponse.ok)
      throw new Error(
        `Gemini API request failed: ${await geminiResponse.text()}`
      );

    const responseData = await geminiResponse.json();
    // Add a safety check in case the AI returns an empty response
    const place_ids =
      JSON.parse(responseData.candidates[0].content.parts[0].text).place_ids ||
      [];

    // If the AI returns no matches, we don't need to do anything else
    if (place_ids.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const newCreditTotal = profile.ai_credits - AI_CREDIT_COST;
    await adminClient
      .from("profiles")
      .update({ ai_credits: newCreditTotal })
      .eq("id", user.id);

    const { data: finalPlaces, error: finalPlacesError } = await adminClient
      .from("places")
      .select("*, categories (id, name)")
      .in("id", place_ids);
    if (finalPlacesError) throw finalPlacesError;

    return new Response(JSON.stringify(finalPlaces), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
