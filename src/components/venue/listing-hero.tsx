type ListingHeroProps = {
  title: string;
};

export function ListingHero({ title }: ListingHeroProps) {
  return (
    <section className="relative -mt-[57px] bg-primary pb-24 pt-[85px] text-primary-foreground sm:pb-32 sm:pt-24">
      <div className="mx-auto w-full max-w-6xl px-4 text-center sm:px-6">
        <h1 className="mx-auto max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {title}
        </h1>
      </div>
    </section>
  );
}
