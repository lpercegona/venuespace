import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PublicHeader } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";

export const Route = createFileRoute("/blog")({
  component: BlogLayout,
});

function BlogLayout() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <Outlet />
      <PublicFooter />
    </div>
  );
}
