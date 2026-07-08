import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FieldError } from "../FieldError";
import { FormErrorSummary } from "../FormErrorSummary";
import { PageErrorState } from "../PageErrorState";
import { ApiError } from "@/lib/apiClient";

describe("FieldError", () => {
    it("renders nothing when there is no message", () => {
        const { container } = render(<FieldError id="x-error">{null}</FieldError>);
        expect(container).toBeEmptyDOMElement();
    });

    it("announces the error via role=alert and exposes the id for aria-describedby", () => {
        render(<FieldError id="email-error">Enter a valid email address.</FieldError>);
        const alert = screen.getByRole("alert");
        expect(alert).toHaveAttribute("id", "email-error");
        expect(alert).toHaveTextContent("Enter a valid email address.");
    });
});

describe("FormErrorSummary", () => {
    it("renders nothing without a message", () => {
        const { container } = render(<FormErrorSummary message="" />);
        expect(container).toBeEmptyDOMElement();
    });

    it("shows title + message as an alert", () => {
        render(<FormErrorSummary title="Your session expired" message="Please sign in again." />);
        const alert = screen.getByRole("alert");
        expect(alert).toHaveTextContent("Your session expired");
        expect(alert).toHaveTextContent("Please sign in again.");
    });
});

describe("PageErrorState", () => {
    it("shows a friendly network message and a working retry for transient errors", () => {
        let retried = 0;
        render(<PageErrorState error={new ApiError(0, "Network request failed")} onRetry={() => { retried++; }} />);
        expect(screen.getByRole("alert")).toHaveTextContent(/connection/i);
        const btn = screen.getByRole("button", { name: /try again/i });
        btn.click();
        expect(retried).toBe(1);
    });

    it("does not offer retry for a non-retryable error (403)", () => {
        render(<PageErrorState error={new ApiError(403, "forbidden", {})} onRetry={() => {}} />);
        expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
    });
});
