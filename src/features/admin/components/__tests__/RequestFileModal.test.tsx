import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RequestFileModal from '../RequestFileModal';
import { useMajors, useCourses, useLecturers, useTypes } from '@/features/courses/hooks/useCatalog';
import { useCreateRequest } from '@/features/files/hooks/useRequests';

vi.mock('@/features/courses/hooks/useCatalog', () => ({
    useMajors: vi.fn(),
    useCourses: vi.fn(),
    useLecturers: vi.fn(),
    useTypes: vi.fn(),
}));

vi.mock('@/features/files/hooks/useRequests', () => ({
    useCreateRequest: vi.fn(),
}));

describe('RequestFileModal', () => {
    const mockMutate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useMajors as any).mockReturnValue({ data: [{ id: 'm1', name: 'Computer Science' }] });
        (useCourses as any).mockReturnValue({ data: [{ id: 'c1', code: 'CS101', name: 'Intro', semester: 1 }] });
        (useLecturers as any).mockReturnValue({ data: [{ id: 'l1', name: 'Dr. Smith' }] });
        (useTypes as any).mockReturnValue({ data: [{ id: 't1', displayName: 'Exam' }] });
        (useCreateRequest as any).mockReturnValue({ mutate: mockMutate, isPending: false });

        // Radix UI requirements for Pointer Events & Focus
        if (!global.PointerEvent) {
            class PointerEvent extends MouseEvent {
                public pointerId?: number;
                public pointerType?: string;
                public isPrimary?: boolean;
                constructor(type: string, params: PointerEventInit = {}) {
                    super(type, params);
                    this.pointerId = params.pointerId;
                    this.pointerType = params.pointerType;
                    this.isPrimary = params.isPrimary;
                }
            }
            global.PointerEvent = PointerEvent as any;
        }
        Object.assign(window.HTMLElement.prototype, {
            scrollIntoView: vi.fn(),
            hasPointerCapture: vi.fn(),
            releasePointerCapture: vi.fn(),
        });
    });

    it('validates each step, cascades clearing, and submits successfully', async () => {
        const user = userEvent.setup();
        render(<RequestFileModal open={true} onOpenChange={vi.fn()} />);

        // --- Step 1: Major and Program Year ---
        let nextBtn = screen.getByRole('button', { name: 'Next' });
        expect(nextBtn).toBeDisabled(); // disabled until major AND program year selected

        // Open major dropdown
        await user.click(screen.getByText('Select a major...'));
        await user.click(screen.getByText('Computer Science'));

        expect(nextBtn).toBeDisabled(); // Year not selected yet

        await user.click(screen.getByRole('button', { name: '1st Year' }));
        expect(nextBtn).not.toBeDisabled();
        await user.click(nextBtn);

        // --- Step 2: Course ---
        expect(screen.getByText('Select the course')).toBeInTheDocument();
        nextBtn = screen.getByRole('button', { name: 'Next' });
        expect(nextBtn).toBeDisabled(); // disabled until course is selected

        await user.click(screen.getByText('Select a course...'));
        await user.click(screen.getByText('CS101 — Intro'));

        expect(nextBtn).not.toBeDisabled();

        // --- Test Cascade: Go back to Step 1 and change Year ---
        await user.click(screen.getByRole('button', { name: 'Back' }));
        await user.click(screen.getByRole('button', { name: '2nd Year' }));
        await user.click(screen.getByRole('button', { name: 'Next' }));

        // Course should be cleared in Step 2, so Next is disabled again
        nextBtn = screen.getByRole('button', { name: 'Next' });
        expect(nextBtn).toBeDisabled();

        // Select Course again to proceed
        await user.click(screen.getByText('Select a course...'));
        await user.click(screen.getByText('CS101 — Intro'));
        await user.click(nextBtn);

        // --- Step 3: File details ---
        expect(screen.getByText('File details')).toBeInTheDocument();
        nextBtn = screen.getByRole('button', { name: 'Next' });
        expect(nextBtn).toBeDisabled(); // disabled until all details filled

        const selects = screen.getAllByText('Select...');
        
        // Select Lecturer (first select)
        await user.click(selects[0].closest('button')!);
        await user.click(screen.getByText('Dr. Smith'));

        // Select Type (second select)
        await user.click(selects[1].closest('button')!);
        await user.click(screen.getByText('Exam'));

        // Enter Title
        await user.type(screen.getByPlaceholderText('e.g. Midterm Solutions'), 'My Test File');

        // Select File Year (third select)
        await user.click(screen.getByText('Year').closest('button')!);
        await user.click(screen.getByText('2023'));

        expect(nextBtn).not.toBeDisabled();
        await user.click(nextBtn);

        // --- Step 4: Upload ---
        expect(screen.getByText('Upload your file')).toBeInTheDocument();
        
        const submitBtn = screen.getByRole('button', { name: 'Submit File' });
        expect(submitBtn).toBeDisabled(); // disabled until valid file



        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        // Test unsupported extension (.exe)
        const exeFile = new File(['dummy'], 'malware.exe', { type: 'application/x-msdownload' });
        fireEvent.change(fileInput, { target: { files: [exeFile] } });
        expect(screen.getByText(/Unsupported file type/)).toBeInTheDocument();
        expect(submitBtn).toBeDisabled();
        
        // Test file too large (> 25MB)
        const largeFile = new File(['dummy'], 'large.pdf', { type: 'application/pdf' });
        Object.defineProperty(largeFile, 'size', { value: 26 * 1024 * 1024 });
        fireEvent.change(fileInput, { target: { files: [largeFile] } });
        expect(screen.getByText(/File is too large/)).toBeInTheDocument();
        expect(submitBtn).toBeDisabled();

        // Upload valid file
        const validFile = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
        fireEvent.change(fileInput, { target: { files: [validFile] } });
        
        expect(screen.queryByText(/Unsupported file type/)).not.toBeInTheDocument();
        expect(screen.queryByText(/File is too large/)).not.toBeInTheDocument();
        expect(submitBtn).not.toBeDisabled();

        // --- Submit ---
        await user.click(submitBtn);

        expect(mockMutate).toHaveBeenCalledTimes(1);
        expect(mockMutate).toHaveBeenCalledWith(
            expect.objectContaining({
                courseId: 'c1',
                lecturerId: 'l1',
                type_id: 't1',
                title: 'My Test File',
                academic_year: 2, // 2nd year
                material_year: 2023,
                file: validFile,
            }),
            expect.any(Object)
        );
    });
});
