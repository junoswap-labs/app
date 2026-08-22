'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import type { DayPickerProps } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export type CalendarProps = DayPickerProps

function Calendar({ className, classNames, showOutsideDays = true, fixedWeeks = true, ...props }: CalendarProps) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            fixedWeeks={fixedWeeks}
            className={cn('p-0', className)}
            classNames={{
                months: 'flex flex-col sm:flex-row gap-2',
                month: 'flex flex-col gap-3',
                month_caption: 'flex justify-center pt-1 relative items-center h-8',
                caption_label: 'text-sm font-medium',
                nav: 'flex items-center justify-between absolute inset-x-0 top-0 h-8',
                button_previous: cn(
                    buttonVariants({ variant: 'outline' }),
                    'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100'
                ),
                button_next: cn(
                    buttonVariants({ variant: 'outline' }),
                    'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100'
                ),
                month_grid: 'w-full border-collapse mt-2',
                weekdays: 'flex',
                weekday: 'text-muted-foreground w-8 text-[0.8rem] font-normal',
                week: 'flex w-full mt-1',
                day: 'p-0 text-center text-sm rounded-md',
                day_button: cn(
                    buttonVariants({ variant: 'ghost' }),
                    'h-8 w-8 p-0 font-normal aria-selected:opacity-100'
                ),
                selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground [&>button]:hover:bg-transparent',
                today: 'bg-accent text-accent-foreground',
                outside: 'text-muted-foreground opacity-50',
                disabled: 'text-muted-foreground opacity-50',
                hidden: 'invisible',
                ...classNames,
            }}
            components={{
                Chevron: ({ orientation, className: chevronClassName, ...chevronProps }) =>
                    orientation === 'left' ? (
                        <ChevronLeft className={cn('h-4 w-4', chevronClassName)} {...chevronProps} />
                    ) : (
                        <ChevronRight className={cn('h-4 w-4', chevronClassName)} {...chevronProps} />
                    ),
            }}
            {...props}
        />
    )
}
Calendar.displayName = 'Calendar'

export { Calendar }
