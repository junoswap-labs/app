'use client'

import * as React from 'react'
import { format, startOfDay } from 'date-fns'
import { CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DateTimePickerProps {
    id?: string
    /** Empty string, or "YYYY-MM-DDTHH:mm" — the same shape a native `<input type="datetime-local">` uses. */
    value: string
    onChange: (value: string) => void
    placeholder?: string
    disabled?: boolean
    className?: string
    /** Calendar days before this date are disabled — e.g. redeem-start can't precede publish date. */
    minDate?: Date
}

function toLocalParts(value: string): { date: Date | undefined; time: string } {
    if (!value) return { date: undefined, time: '00:00' }
    const [datePart, timePart] = value.split('T')
    if (!datePart) return { date: undefined, time: '00:00' }
    const [year, month, day] = datePart.split('-').map(Number)
    if (!year || !month || !day) return { date: undefined, time: timePart ?? '00:00' }
    return { date: new Date(year, month - 1, day), time: timePart ?? '00:00' }
}

function toValue(date: Date, time: string): string {
    const year = date.getFullYear().toString().padStart(4, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}T${time || '00:00'}`
}

/** Click-to-open Popover date+time picker — same value/onChange shape as a native
 *  `<input type="datetime-local">` so it's a drop-in replacement. */
export function DateTimePicker({ id, value, onChange, placeholder = 'Pick a date', disabled, className, minDate }: DateTimePickerProps) {
    const [open, setOpen] = React.useState(false)
    const { date, time } = toLocalParts(value)

    const handleSelectDate = (selected: Date | undefined) => {
        if (!selected) return
        onChange(toValue(selected, time))
    }

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(toValue(date ?? new Date(), e.target.value))
    }

    const setNow = () => {
        const now = new Date()
        onChange(toValue(now, format(now, 'HH:mm')))
        setOpen(false)
    }
    const nowDisabled = Boolean(minDate && new Date() < minDate)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        'h-9 w-full min-w-0 justify-start gap-2 overflow-hidden rounded-md border-input px-3 font-normal text-foreground',
                        !date && 'text-muted-foreground',
                        className
                    )}
                >
                    <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{date ? format(date, 'PP') + ` · ${time}` : placeholder}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[290px]" align="start" collisionPadding={12}>
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleSelectDate}
                    defaultMonth={date ?? minDate}
                    disabled={minDate ? { before: startOfDay(minDate) } : undefined}
                    className="w-full"
                />
                <div className="mt-2 space-y-1.5 border-t pt-3">
                    <Label htmlFor={id ? `${id}-time` : undefined} className="text-xs">
                        Time
                    </Label>
                    <Input id={id ? `${id}-time` : undefined} type="time" value={time} disabled={!date} onChange={handleTimeChange} />
                </div>
                <div className="mt-3 flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="flex-1" disabled={nowDisabled} onClick={setNow}>
                        Now
                    </Button>
                    <Button type="button" size="sm" className="flex-1" disabled={!date} onClick={() => setOpen(false)}>
                        Done
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
