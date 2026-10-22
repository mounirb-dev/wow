"use client"

import * as React from "react"
import { cn } from "cn"
import useEmblaCarousel from "embla-carousel-react"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"

// Carousel de shadcn (embla) adaptado a este proyecto. Diferencias con el original:
//  - sin `setApi`: el padre recibe el índice con `onIndexChange(index)` (se llama desde el evento "select" de
//    embla) y manda órdenes con `ref` (`ref.current.scrollTo(i)`), en vez de copiar la API a su estado con un efecto;
//  - las flechas se habilitan leyendo embla con useSyncExternalStore (con su limpieza), no con estado + efecto;
//  - sin márgenes entre diapositivas (cada una ocupa todo el ancho) y las flechas van dentro del carrusel.

const CarouselContext = React.createContext(null)

function useCarousel() {
  const context = React.useContext(CarouselContext)

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />")
  }

  return context
}

// Lee un valor de embla y se vuelve a renderizar cuando cambia (selección o reinicio).
function useEmblaValue(api, read) {
  const subscribe = React.useCallback(
    (notify) => {
      if (!api) return () => {}
      api.on("select", notify)
      api.on("reInit", notify)
      return () => {
        api.off("select", notify)
        api.off("reInit", notify)
      }
    },
    [api]
  )
  return React.useSyncExternalStore(
    subscribe,
    () => (api ? read(api) : false),
    () => false
  )
}

function Carousel({
  orientation = "horizontal",
  opts,
  plugins,
  onIndexChange,
  ref,
  className,
  children,
  ...props
}) {
  const [carouselRef, api] = useEmblaCarousel(
    {
      ...opts,
      axis: orientation === "horizontal" ? "x" : "y",
    },
    plugins
  )
  const canScrollPrev = useEmblaValue(api, (embla) => embla.canScrollPrev())
  const canScrollNext = useEmblaValue(api, (embla) => embla.canScrollNext())

  const scrollPrev = React.useCallback(() => {
    api?.scrollPrev()
  }, [api])

  const scrollNext = React.useCallback(() => {
    api?.scrollNext()
  }, [api])

  React.useImperativeHandle(ref, () => ({ scrollTo: (index) => api?.scrollTo(index) }), [api])

  const handleKeyDown = React.useCallback(
    (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        scrollPrev()
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        scrollNext()
      }
    },
    [scrollPrev, scrollNext]
  )

  // useEffectEvent: el callback del padre puede cambiar en cada render sin volver a suscribirse a embla.
  const emitSelect = React.useEffectEvent(() => {
    if (api) onIndexChange?.(api.selectedScrollSnap())
  })

  React.useEffect(() => {
    if (!api) return undefined
    const handleSelect = () => emitSelect()
    api.on("select", handleSelect)
    return () => {
      api.off("select", handleSelect)
    }
  }, [api])

  const context = React.useMemo(
    () => ({ carouselRef, orientation, scrollPrev, scrollNext, canScrollPrev, canScrollNext }),
    [carouselRef, orientation, scrollPrev, scrollNext, canScrollPrev, canScrollNext]
  )

  return (
    <CarouselContext.Provider value={context}>
      <div
        onKeyDownCapture={handleKeyDown}
        className={cn("relative", className)}
        role="region"
        aria-roledescription="carousel"
        data-slot="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  )
}

function CarouselContent({ className, ...props }) {
  const { carouselRef, orientation } = useCarousel()

  return (
    <div
      ref={carouselRef}
      className="h-full overflow-hidden"
      data-slot="carousel-content"
    >
      <div
        className={cn(
          "flex h-full",
          orientation === "horizontal" ? "" : "flex-col",
          className
        )}
        {...props}
      />
    </div>
  )
}

function CarouselItem({ className, ...props }) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      className={cn("min-w-0 shrink-0 grow-0 basis-full", className)}
      {...props}
    />
  )
}

function CarouselPrevious({
  className,
  variant = "outline",
  size = "icon",
  ...props
}) {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel()

  return (
    <Button
      data-slot="carousel-previous"
      variant={variant}
      size={size}
      className={cn(
        "absolute size-8 rounded-full",
        orientation === "horizontal"
          ? "top-1/2 left-3 z-10 -translate-y-1/2"
          : "top-3 left-1/2 z-10 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ArrowLeft />
      <span className="sr-only">Anterior</span>
    </Button>
  )
}

function CarouselNext({
  className,
  variant = "outline",
  size = "icon",
  ...props
}) {
  const { orientation, scrollNext, canScrollNext } = useCarousel()

  return (
    <Button
      data-slot="carousel-next"
      variant={variant}
      size={size}
      className={cn(
        "absolute size-8 rounded-full",
        orientation === "horizontal"
          ? "top-1/2 right-3 z-10 -translate-y-1/2"
          : "bottom-3 left-1/2 z-10 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ArrowRight />
      <span className="sr-only">Siguiente</span>
    </Button>
  )
}

export {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
}
