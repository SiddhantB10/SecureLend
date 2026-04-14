import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <div className="min-h-screen bg-secure-950 px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl place-items-center lg:grid-cols-2 lg:gap-12">
        <div className="hidden lg:block">
          <p className="text-xs uppercase tracking-[0.35em] text-neon-500/80">SecureLend</p>
          <h1 className="mt-4 max-w-lg text-5xl font-semibold leading-tight">Sign in to monitor loan risk and manage applications.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/60">
            Review applications, see explainable risk scores, and track admin decisions through the blockchain audit trail.
          </p>
        </div>
        <div className="w-full max-w-md">
          <AuthForm mode="login" values={values} errors={errors} onChange={handleChange} onSubmit={handleSubmit} loading={loading} />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
