'use client'

import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'

import { cn } from '@/lib/utils'

const Slider = React.forwardRef<
    React.ElementRef<typeof SliderPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
    <SliderPrimitive.Root
        ref={ref}
        className={cn('relative flex w-full touch-none select-none items-center', className)}
        {...props}
    >
        <SliderPrimitive.Track className="relative w-full h-1.5 bg-muted-foreground/10 rounded-full grow">
            <SliderPrimitive.Range className="absolute h-full bg-foreground/25 rounded-full" />
        </SliderPrimitive.Track>
        {props.value?.map((_, i) => (
            <SliderPrimitive.Thumb
                key={i}
                className={cn(
                    'block w-3.5 h-3.5 bg-foreground rounded-full shadow-sm',
                    'ring-2 ring-foreground/20',
                    'hover:ring-foreground/40',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'transition-shadow',
                    'cursor-grab active:cursor-grabbing',
                    'disabled:pointer-events-none disabled:opacity-50',
                    'z-20'
                )}
            />
        ))}
    </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
