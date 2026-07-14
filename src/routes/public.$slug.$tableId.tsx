import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/public/$slug/$tableId")({
  component: () => <Outlet />,
});
