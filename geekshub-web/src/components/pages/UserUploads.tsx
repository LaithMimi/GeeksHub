import { useState } from "react";
import { FileText, Search, Filter, AlertCircle, CheckCircle, Clock, XCircle, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { userRequests } from "@/lib/data";
import RequestFileModal from "@/components/features/RequestFileModal";

export default function UserUploads() {
    const [isRequestOpen, setIsRequestOpen] = useState(false);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "approved": return <CheckCircle className="h-4 w-4 text-green-500" />;
            case "rejected": return <XCircle className="h-4 w-4 text-red-500" />;
            default: return <Clock className="h-4 w-4 text-yellow-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "approved": return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
            case "rejected": return "bg-red-500/10 text-red-500 hover:bg-red-500/20";
            default: return "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20";
        }
    };

    return (
        <div className="animate-fade-in space-y-8 p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link to="/" className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm w-fit transition-colors">
                    <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                    Back to Dashboard
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Your Uploads</h1>
                        <p className="text-muted-foreground mt-2">Track the status of your file contributions.</p>
                    </div>
                    <Button onClick={() => setIsRequestOpen(true)}>
                        <FileText className="me-2 h-4 w-4" />
                        Submit New File
                    </Button>
                </div>
                <RequestFileModal open={isRequestOpen} onOpenChange={setIsRequestOpen} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Uploads</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{userRequests.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {userRequests.filter(f => f.status === "pending").length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Approved</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {userRequests.filter(f => f.status === "approved").length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters & Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search uploads..." className="ps-9 pe-12" />
                    <kbd className="absolute end-2.5 top-2.5 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                        <span className="text-xs">Ctrl</span> K
                    </kbd>
                </div>
                <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                </Button>
            </div>

            {/* List */}
            <div className="rounded-md border bg-card">
                <div className="p-4 grid gap-4">
                    {userRequests.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <FileText className="mx-auto h-12 w-12 opacity-20 mb-4" />
                            <p>No uploads yet.</p>
                        </div>
                    ) : (
                        userRequests.map((file) => (
                            <div key={file.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-background hover:bg-muted/50 transition-colors gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 p-2 rounded-lg bg-primary/10">
                                        <FileText className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="font-semibold flex items-center gap-2">
                                            {file.title}
                                            <Badge variant="secondary" className={`capitalize ${getStatusColor(file.status)}`}>
                                                {getStatusIcon(file.status)}
                                                <span className="ms-1.5">{file.status}</span>
                                            </Badge>
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {file.courseId.toUpperCase()} • {file.date}
                                        </div>
                                        {file.status === "rejected" && file.rejectionReason && (
                                            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/5 px-2 py-1 rounded w-fit mt-2">
                                                <AlertCircle className="h-3 w-3" />
                                                Rejection Reason: {file.rejectionReason}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {file.status === "rejected" ? (
                                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                            Delete
                                        </Button>
                                    ) : (
                                        <Button variant="outline" size="sm" asChild>
                                            <Link to={`/courses/cs101/files/${file.id}`}>View</Link>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
