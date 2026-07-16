import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PublicHeader } from "@/components/venue/public-header";

export const Route = createFileRoute("/blog")({
  component: BlogLayout,
});

function BlogLayout() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <Outlet />
    </div>
  );
}
