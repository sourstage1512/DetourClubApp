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

    // --- NEW: The function now accepts geographic data ---
    const { queryText, selectedCategories, latitude, longitude, radius_km } =
      await req.json();
    if (!queryText || !latitude || !longitude || !radius_km) {
      throw new Error(
        "Missing required geographic parameters in the request body."
      );
    }

    // --- NEW: Geospatial Pre-Filtering Logic ---
    // We call a remote procedure call (RPC) to a custom Postgres function
    // that can perform the geographic search. We will create this function next.
    const { data: places, error: placesError } = await adminClient.rpc(
      "places_in_radius",
      {
        search_lat: latitude,
        search_lon: longitude,
        radius_meters: radius_km * 1000, // Convert KM to meters
        category_names: selectedCategories,
      }
    );

    if (placesError) throw placesError;
    if (!places || places.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // The rest of the function is the same, but operates on the geo-filtered list
    const placesContext = (places as any[])
      .map((p) => {
        const tags = p.tags.map((t: any) => t.name).join(", ");
        return `Place(id: ${p.id}, name: "${p.name}", category: "${p.category_name}", neighborhood: "${p.neighborhood}", budget_level: "${p.budget_level}", description: "${p.description}", notes: "${p.notes}", tags: [${tags}])`;
      })
      .join("\n");

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY is not set.");

    const prompt = `You are a travel discovery assistant... Your task is to act as a powerful ranking engine...
    User's Nuanced Request: "${queryText}"
    Pre-filtered List of Available Places:
    ${placesContext}
    ...return a JSON object...
    `;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`,
      {
        /* ... fetch options ... */
      }
    );

    if (!geminiResponse.ok)
      throw new Error(
        `Gemini API request failed: ${await geminiResponse.text()}`
      );

    const responseData = await geminiResponse.json();
    const place_ids =
      JSON.parse(responseData.candidates[0].content.parts[0].text).place_ids ||
      [];

    if (place_ids.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newCreditTotal = profile.ai_credits - AI_CREDIT_COST;
    await adminClient
      .from("profiles")
      .update({ ai_credits: newCreditTotal })
      .eq("id", user.id);

    // To return the full place data, we need to fetch the recommended places again
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
