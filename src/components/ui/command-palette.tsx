import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { useRecentFiles } from "@/queries/useFiles"
import {
    Home,
    BookOpen,
    History,
    Upload,
    Settings,
    LogOut,
    Shield,
    FileText
} from "lucide-react"

export function CommandPalette() {
    const [open, setOpen] = useState(false)
    const navigate = useNavigate()
    const { user, signOut } = useAuth()
    const { data: recentFiles } = useRecentFiles()

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    const runCommand = (command: () => void) => {
        setOpen(false)
        command()
    }

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>

                <CommandGroup heading="Navigation">
                    <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
                        <Home className="mr-2 h-4 w-4" />
                        Dashboard
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/courses"))}>
                        <BookOpen className="mr-2 h-4 w-4" />
                        Courses
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/recent"))}>
                        <History className="mr-2 h-4 w-4" />
                        Recent
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/uploads"))}>
                        <Upload className="mr-2 h-4 w-4" />
                        Uploads
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </CommandItem>
                </CommandGroup>

                {recentFiles && recentFiles.length > 0 && (
                    <>
                        <CommandSeparator />
                        <CommandGroup heading="Recent Files">
                            {recentFiles.slice(0, 3).map((file) => (
                                <CommandItem
                                    key={file.id}
                                    onSelect={() => runCommand(() => navigate(`/courses/${file?.courseId || "unknown"}/files/${file.id}`))}
                                >
                                    <FileText className="mr-2 h-4 w-4" />
                                    <div className="flex flex-col">
                                        <span>{file.title}</span>
                                        <span className="text-xs text-muted-foreground">{file.type}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </>
                )}

                <CommandSeparator />

                <CommandGroup heading="Account">
                    {user?.role === "ADMIN" && (
                        <CommandItem onSelect={() => runCommand(() => navigate("/admin"))}>
                            <Shield className="mr-2 h-4 w-4" />
                            Admin Dashboard
                        </CommandItem>
                    )}
                    <CommandItem onSelect={() => runCommand(() => signOut())}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                    </CommandItem>
                </CommandGroup>

            </CommandList>
        </CommandDialog>
    )
}
