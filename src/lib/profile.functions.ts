import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/require-auth-middleware";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, email, display_name, avatar_url")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      display_name: z.string().min(1).max(80).optional(),
      avatar_url: z.string().max(500).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, any> = {};
    if (data.display_name !== undefined) patch.display_name = data.display_name;
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;
    const { error } = await context.supabase
      .from("profiles")
      .update(patch as any)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Server-generated signed URL for a stored object; used to render private uploads.
export const getSignedUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ path: z.string().min(1).max(500), expires_in: z.number().int().min(60).max(60 * 60 * 24).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Use the user-scoped Supabase client so the bucket's owner-only RLS policy
    // is enforced. This prevents any signed-in user from minting a signed URL
    // for a path they do not own.
    const { data: signed, error } = await context.supabase
      .storage
      .from("venue-uploads")
      .createSignedUrl(data.path, data.expires_in ?? 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
