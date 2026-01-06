/**
 * BulkActionBar Component
 * 
 * A sticky bar that appears when rows are selected in the DataTable.
 * Provides bulk approve/reject actions with confirmation.
 */

import { CheckCircle2, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BulkActionBarProps {
    selectedCount: number;
    onApprove: () => void;
    onReject: () => void;
    onClear: () => void;
    isApproving?: boolean;
    isRejecting?: boolean;
}

export function BulkActionBar({
    selectedCount,
    onApprove,
    onReject,
    onClear,
    isApproving = false,
    isRejecting = false,
}: BulkActionBarProps) {
    if (selectedCount === 0) return null;

    return (
        <div className="sticky bottom-4 z-50 mx-auto max-w-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3 rounded-lg border bg-background/95 backdrop-blur p-3 shadow-lg">
                <Badge variant="secondary" className="text-sm">
                    {selectedCount} selected
                </Badge>

                <div className="flex-1" />

                <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5 bg-green-600 hover:bg-green-700"
                    onClick={onApprove}
                    disabled={isApproving || isRejecting}
                >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve All
                </Button>

                <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    onClick={onReject}
                    disabled={isApproving || isRejecting}
                >
                    <XCircle className="h-4 w-4" />
                    Reject All
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    disabled={isApproving || isRejecting}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
