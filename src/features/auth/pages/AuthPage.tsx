import AuthLayout from "@/features/auth/components/AuthLayout";
import SlidingAuth from "@/features/auth/components/SlidingAuth";

export default function AuthPage() {
    return (
        <AuthLayout>
            <SlidingAuth />
        </AuthLayout>
    );
}
