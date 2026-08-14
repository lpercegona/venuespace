type ListingHeroProps = {
  title: string;
  /** Quando true, o hero desliza sob o header sticky (usado quando não há trilha acima). */
  offsetHeader?: boolean;
};

export function ListingHero({ title, offsetHeader = true }: ListingHeroProps) {
  return (
    <section className={`relative bg-primary text-primary-foreground ${offsetHeader ? "-mt-[57px]" : ""}`}>
      <div className="mx-auto w-full max-w-6xl px-4 text-center sm:px-4">
        <h1
          className={`mx-auto max-w-3xl pb-14 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-6xl ${
            offsetHeader ? "pt-24" : "pt-14"
          }`}
        >
          {title}
        </h1>
      </div>
    </section>
  );
}
