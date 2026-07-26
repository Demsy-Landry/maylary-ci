/**
 * Ambiance de fond du hero — dégradé chaud animé + halos lumineux doux.
 * Les illustrations figuratives (secteurs vendus) sont dans Index.tsx,
 * en contenu visible, pas ici : ce composant reste une simple respiration
 * de fond, jamais du contenu qu'un lecteur d'écran devrait connaître.
 */
export default function HeroScene() {
  return (
    <div
      className="hero-scene pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute inset-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 motion-safe:fill-mode-both">
        <div className="animate-sky-drift absolute inset-0 bg-[length:200%_200%] bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <div className="animate-glow-drift-a absolute -top-8 -left-16 h-72 w-72 rounded-full bg-primary/20 blur-3xl sm:h-96 sm:w-96" />
        <div className="animate-glow-drift-b absolute top-1/4 right-0 h-64 w-64 rounded-full bg-accent/15 blur-3xl sm:h-80 sm:w-80" />
        <div className="animate-glow-drift-c absolute top-1/3 left-1/3 h-56 w-56 rounded-full bg-primary/10 blur-3xl sm:h-72 sm:w-72" />
      </div>
    </div>
  );
}
