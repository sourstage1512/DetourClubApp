import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Create a client to authenticate the user based on their token
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

    // 2. Create an admin client with the Service Role Key to perform deletions
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    if (!serviceKey) throw new Error("SERVICE_ROLE_KEY is not set.");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceKey
    );

    // 3. Perform the deletion using the admin client
    const { error } = await adminClient.auth.admin.deleteUser(user.id);

    if (error) {
      throw error;
    }

    // 4. Return a success message
    return new Response(
      JSON.stringify({ message: "User deleted successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
