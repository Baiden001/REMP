import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EditProjectForm from "./edit-project-form";

export default async function EditProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["ceo", "it"].includes(profile.role)) {
    redirect("/dashboard/projects");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, location, status, construction_progress")
    .eq("id", params.id)
    .single();

  if (!project) {
    redirect("/dashboard/projects");
  }

  return <EditProjectForm project={project} />;
}