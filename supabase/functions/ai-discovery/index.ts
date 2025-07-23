import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

// Type definitions for clarity
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
  console.log("--- Function Invoked (Final Production Version) ---");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate the user
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

    // 2. Create an admin client to bypass RLS for trusted server operations
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    if (!serviceKey) throw new Error("SERVICE_ROLE_KEY is not set.");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceKey
    );

    // 3. Check for sufficient AI credits
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

    const { queryText, cityId } = await req.json();
    if (!queryText || !cityId) {
      throw new Error('Missing "queryText" or "cityId" in the request body.');
    }

    // 4. Fetch all place data to build context for the AI
    const { data: places, error: placesError } = await adminClient
      .from("places")
      .select(
        "id, name, description, notes, neighborhood, budget_level, categories (name), tags (name)"
      )
      .eq("city_id", String(cityId))
      .eq("status", "published");

    if (placesError) throw placesError;
    if (!places || places.length === 0) {
      throw new Error(
        `No places found for cityId: ${cityId} with status 'published'.`
      );
    }

    const placesContext = (places as Place[])
      .map((p: Place) => {
        const tags = p.tags.map((t) => t.name).join(", ");
        return `Place(id: ${p.id}, name: "${p.name}", category: "${p.categories.name}", neighborhood: "${p.neighborhood}", budget_level: "${p.budget_level}", description: "${p.description}", notes: "${p.notes}", tags: [${tags}])`;
      })
      .join("\n");

    // 5. Call the Gemini API
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY is not set.");

    const prompt = `You are a travel discovery assistant for an app called "Detour Club". Your task is to analyze a user's request and a provided list of curated places. You must select the top 3-5 places that best match the user's request.

    User Request: "${queryText}"

    Here is the list of available places:
    ${placesContext}

    Based on the user's request, return a JSON object with a single key "place_ids" which is an array of the integer IDs of the recommended places. For example: {"place_ids": [123, 45, 678]}. Do not explain your choices, only return the JSON.
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
    const { place_ids } = JSON.parse(
      responseData.candidates[0].content.parts[0].text
    );

    // --- THIS IS THE FIX ---
    // 6. Deduct credits from the user's profile in the database
    const newCreditTotal = profile.ai_credits - AI_CREDIT_COST;
    await adminClient
      .from("profiles")
      .update({ ai_credits: newCreditTotal })
      .eq("id", user.id);

    // 7. Fetch the full details of the recommended places to return to the app
    const { data: finalPlaces, error: finalPlacesError } = await adminClient
      .from("places")
      .select("*, categories (id, name)")
      .in("id", place_ids);

    if (finalPlacesError) throw finalPlacesError;

    // 8. Return the final result
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
