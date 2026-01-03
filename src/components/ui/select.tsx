import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

const SelectContext = React.createContext<{
    value?: string
    onValueChange?: (value: string) => void
    open?: boolean
    setOpen?: (open: boolean) => void
}>({})

interface SelectProps {
    value?: string
    onValueChange?: (value: string) => void
    children?: React.ReactNode
    disabled?: boolean
}

const Select = ({ value, onValueChange, children, disabled }: SelectProps) => {
    const [open, setOpen] = React.useState(false)

    return (
        <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
            <DropdownMenu open={open} onOpenChange={setOpen}>
                {/* We pass a Fragment to allow children to include the trigger directly */}
                {children}
            </DropdownMenu>
        </SelectContext.Provider>
    )
}

const SelectTrigger = React.forwardRef<
    React.ElementRef<typeof DropdownMenuTrigger>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuTrigger>
>(({ className, children, ...props }, ref) => (
    <DropdownMenuTrigger
        ref={ref}
        className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
        )}
        {...props}
    >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
    </DropdownMenuTrigger>
))
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = React.forwardRef<
    HTMLSpanElement,
    React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }
>(({ className, placeholder, ...props }, ref) => {
    const { value } = React.useContext(SelectContext)
    return (
        <span
            ref={ref}
            className={cn("line-clamp-1", className)}
            {...props}
        >
            {value || placeholder}
        </span>
    )
})
SelectValue.displayName = "SelectValue"

const SelectContent = React.forwardRef<
    React.ElementRef<typeof DropdownMenuContent>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuContent>
>(({ className, children, position = "popper", ...props }, ref) => (
    <DropdownMenuContent
        ref={ref}
        className={cn(
            "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80",
            position === "popper" && "translate-y-1",
            className
        )}
        position={position}
        {...props}
    >
        <div className="w-full p-1">
            {children}
        </div>
    </DropdownMenuContent>
))
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef<
    React.ElementRef<typeof DropdownMenuItem>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuItem> & { value: string }
>(({ className, children, value, ...props }, ref) => {
    const { onValueChange, value: selectedValue } = React.useContext(SelectContext)
    return (
        <DropdownMenuItem
            ref={ref}
            className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className
            )}
            onClick={() => onValueChange?.(value)}
            {...props}
        >
            {selectedValue === value && (
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <Check className="h-4 w-4" />
                </span>
            )}
            <span className="truncate">{children}</span>
        </DropdownMenuItem>
    )
})
SelectItem.displayName = "SelectItem"

export {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
}
