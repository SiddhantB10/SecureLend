import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import AuthForm from '../components/AuthForm';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!values.email) nextErrors.email = 'Email is required';
    if (!values.password) nextErrors.password = 'Password is required';
    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      const response = await login(values);
      navigate(response.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (error) {
      setErrors({ form: error.response?.data?.message || 'Unable to sign in' });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <header className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.3em] text-neon-500">
          <ShieldCheck className="h-5 w-5" />SecureLend
        </Link>
      </header>
      <main className="flex-1 px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid min-h-[calc(100vh-10rem)] max-w-6xl place-items-center lg:grid-cols-2 lg:gap-12">
          <div className="hidden lg:block">
            <p className="text-xs uppercase tracking-[0.35em] text-neon-500/80">SecureLend</p>
            <h1 className="mt-4 max-w-lg text-5xl font-semibold leading-tight text-gray-900">Sign in to manage your loan applications with confidence.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-gray-600">
              Review status updates, check application details, and stay informed throughout each lending decision.
            </p>
          </div>
          <div className="w-full max-w-md">
            <AuthForm mode="login" values={values} errors={errors} onChange={handleChange} onSubmit={handleSubmit} loading={loading} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
