"use client";

import * as React from "react";
import { ArrowUpRight, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { ReactNode } from "react";

export interface CardItem {
  id: string;
  category: string;
  title: ReactNode;
  src: string;
  alt?: string;
  date?: string;
  coordinates?: string;
  description?: string;
  raw?: any;
}

const defaultCards: CardItem[] = [
  {
    id: "1",
    category: "Design Excellence",
    title: <>Elegant experiences, thoughtfully created.</>,
    src: "https://images-assets.nasa.gov/image/PIA26574/PIA26574~small.jpg",
  },
  {
    id: "2",
    category: "Quality",
    title: <>Attention to detail, from start to finish.</>,
    src: "https://images-assets.nasa.gov/image/PIA26310/PIA26310~small.jpg",
  },
];

interface AppleCardCarouselProps {
  cards?: CardItem[];
  heading?: ReactNode;
  onCardClick?: (card: CardItem) => void;
  selectedId?: string;
  className?: string;
}

interface GalleryCardProps {
  card: CardItem;
  isSelected: boolean;
  eager: boolean;
  onCardClick?: (card: CardItem) => void;
}

// One card. It re-renders only when its own card or its selected state changes, so picking an image does
// not redraw all the others (a search can return dozens).
const GalleryCard = React.memo(function GalleryCard({ card, isSelected, eager, onCardClick }: GalleryCardProps) {
  return (
    <div
      onClick={() => onCardClick?.(card)}
      className={`group relative w-[210px] sm:w-[245px] lg:w-[265px] h-[245px] sm:h-[265px] lg:h-[280px] shrink-0 overflow-hidden flex flex-col justify-between p-4 sm:p-4.5 rounded-xl transition-all duration-200 cursor-pointer select-none ${
        isSelected
          ? "ring-2 ring-[#ff8c69] ring-offset-2 ring-offset-black scale-[1.01] shadow-[0_0_24px_rgba(255,140,105,0.4)]"
          : "border border-white/15 hover:border-white/40 hover:scale-[1.01] hover:shadow-xl hover:shadow-black/70"
      }`}
    >
      {/* Background Image */}
      <img
        src={card.src}
        alt={
          card.alt ||
          (typeof card.title === "string"
            ? card.title
            : card.category)
        }
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchpriority={eager ? "high" : "auto"}
        onError={(e: any) => {
          e.target.onerror = null;
          e.target.src = "https://images-assets.nasa.gov/image/PIA26574/PIA26574~small.jpg";
        }}
      />

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/60 pointer-events-none" />

      {/* Top content */}
      <div className="relative z-10 flex flex-col gap-1.5 text-white">
        <div className="flex items-center justify-between gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[#ffaa88] truncate max-w-[140px]">
            {card.category}
          </span>
          {card.date && (
            <span className="font-mono text-[9px] text-zinc-300 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-xs shrink-0">
              {card.date}
            </span>
          )}
        </div>

        <div className="text-xs sm:text-sm font-bold tracking-tight leading-snug line-clamp-2 mt-0.5 text-white drop-shadow-md">
          {card.title}
        </div>

        {card.coordinates && (
          <p className="font-mono text-[10px] text-zinc-400 flex items-center gap-1">
            <span className="text-[#ff8c69]">✦</span>
            <span>{card.coordinates}</span>
          </p>
        )}
      </div>

      {/* Bottom content */}
      <div className="relative z-10 flex items-end justify-between pt-2">
        <div className="text-[10px] text-zinc-300 font-mono tracking-wide flex items-center gap-1.5 opacity-90 group-hover:opacity-100">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff8c69] animate-pulse" />
          <span className="uppercase text-[9px] sm:text-[10px]">Inspect</span>
        </div>

        <Button
          size="icon"
          className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full shadow-md cursor-pointer flex items-center justify-center transition-all duration-200 ${
            isSelected
              ? "bg-[#ff8c69] text-black hover:bg-[#ffaa88]"
              : "bg-white text-black hover:bg-white/90"
          }`}
        >
          <ArrowUpRight
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              isSelected ? "rotate-45" : "group-hover:rotate-45"
            } will-change-transform`}
          />
        </Button>
      </div>
    </div>
  );
});

const AppleCardCarousel: React.FC<AppleCardCarouselProps> = ({
  cards = defaultCards,
  heading = null,
  onCardClick,
  selectedId,
  className = "",
}) => {
  const [api, setApi] = React.useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(true);

  React.useEffect(() => {
    if (!api) return;
    const update = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };
    update();
    api.on("select", update);
    api.on("reInit", update);
    return () => {
      api.off("select", update);
      api.off("reInit", update);
    };
  }, [api]);

  return (
    <div className={`w-full py-1 ${className}`}>
      {/* Header */}
      {heading && (
        <div className="px-2 mb-3 flex items-center justify-between gap-4">
          <div className="text-lg sm:text-xl font-medium tracking-tight text-white">
            {heading}
          </div>
          <div className="hidden sm:flex gap-1.5">
            <Button
              variant="outline"
              size="icon"
              onClick={() => api?.scrollPrev()}
              disabled={!canScrollPrev}
              className="h-7 w-7 rounded-full bg-[#0a0d14] border-white/20 text-white hover:bg-white/10 hover:text-white disabled:opacity-30 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => api?.scrollNext()}
              disabled={!canScrollNext}
              className="h-7 w-7 rounded-full bg-[#0a0d14] border-white/20 text-white hover:bg-white/10 hover:text-white disabled:opacity-30 cursor-pointer"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Card Strip */}
      <Carousel
        setApi={setApi}
        opts={{ align: "start", dragFree: true }}
        className="w-full"
      >
        <CarouselContent className="-ml-3 sm:-ml-3.5 px-1 py-1">
          {cards.map((card, index) => {
            const isSelected = selectedId === card.id;
            return (
              <CarouselItem key={card.id} className="pl-3 sm:pl-3.5 basis-auto">
                <GalleryCard card={card} isSelected={isSelected} eager={index < 5} onCardClick={onCardClick} />
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {/* Floating Prev/Next buttons on top right for easy navigation */}
      <div className="flex sm:hidden justify-end gap-1.5 px-1 mt-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => api?.scrollPrev()}
          disabled={!canScrollPrev}
          className="h-7 w-7 rounded-full bg-[#0a0d14] border-white/20 text-white disabled:opacity-30"
        >
          <ArrowLeft className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => api?.scrollNext()}
          disabled={!canScrollNext}
          className="h-7 w-7 rounded-full bg-[#0a0d14] border-white/20 text-white disabled:opacity-30"
        >
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

export default AppleCardCarousel;
