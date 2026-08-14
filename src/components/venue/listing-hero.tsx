type ListingHeroProps = {
  title: string;
};

export function ListingHero({ title }: ListingHeroProps) {
  return (
    <section className="relative -mt-[57px] bg-primary pt-[64px] pb-[64px] text-primary-foreground sm:pt-24 sm:pb-24">
      <div className="mx-auto w-full max-w-6xl px-4 text-center sm:px-6">
        <h1 className="mx-auto max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-6xl">
          {title}
        </h1>
      </div>
    </section>
  );
}
