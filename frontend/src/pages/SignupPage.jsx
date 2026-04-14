import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthForm from '../components/AuthForm';
import { useAuth } from '../context/AuthContext';

const SignupPage = () => {
  const navigate = useNavigate();
  const { signup, loading } = useAuth();
  const [values, setValues] = useState({ name: '', email: '', password: '', phone: '' });
  const [errors, setErrors] = useState({});

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  const validate = () => {
    const nextErrors = {};
    if (values.name.trim().length < 2) nextErrors.name = 'Name must be at least 2 characters';
    if (!values.email.includes('@')) nextErrors.email = 'Enter a valid email address';
    if (values.password.length < 8) nextErrors.password = 'Password must be at least 8 characters';
    if (values.phone.trim().length < 7) nextErrors.phone = 'Phone number is required';
    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      const response = await signup(values);
      navigate(response.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (error) {
      setErrors({ form: error.response?.data?.message || 'Unable to create account' });
    }
  };

  return (
    <div className="min-h-screen bg-secure-950 px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl place-items-center lg:grid-cols-2 lg:gap-12">
        <div className="hidden lg:block">
          <p className="text-xs uppercase tracking-[0.35em] text-neon-500/80">Join SecureLend</p>
          <h1 className="mt-4 max-w-lg text-5xl font-semibold leading-tight">Create an account and start an intelligent loan application.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/60">
            The system checks your application against an ML fraud model, stores the result securely, and gives you a transparent explanation.
          </p>
        </div>
        <div className="w-full max-w-md">
          <AuthForm mode="signup" values={values} errors={errors} onChange={handleChange} onSubmit={handleSubmit} loading={loading} />
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
