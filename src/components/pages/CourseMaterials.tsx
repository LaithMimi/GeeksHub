import { Link, useParams } from "react-router-dom";

export default function CourseMaterials() {
    const { courseId } = useParams();
    return (
        <div className="p-4">
            <h2 className="text-xl font-semibold mb-4">Materials</h2>
            <ul className="space-y-2">
                <li>
                    <Link
                        to={`/courses/${courseId}/files/123`}
                        className="block p-2 border rounded hover:bg-slate-50"
                    >
                        Introduction to Algorithms.pdf
                        <span className="block text-xs text-muted-foreground">Click to open Study View</span>
                    </Link>
                </li>
            </ul>
        </div>
    );
}
