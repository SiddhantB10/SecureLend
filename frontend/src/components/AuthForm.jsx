import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, LockKeyhole, Phone, UserRound } from 'lucide-react';

const AuthForm = ({
  mode,
  values,
  errors,
  onChange,
  onSubmit,
  loading,
}) => {
  const isLogin = mode === 'login';
  const controlClass = 'secure-form-control';

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-3xl border border-gray-200 bg-gray-50 p-8 shadow-glow backdrop-blur"
    >
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.35em] text-neon-500/80">Secure access</p>
        <h1 className="mt-3 text-3xl font-semibold text-gray-900">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-2 text-sm text-gray-600">
          {isLogin
            ? 'Sign in to review your loan applications and monitoring status.'
            : 'Create your account to apply for loans and manage your application journey in INR.'}
        </p>
      </div>

      <div className="space-y-4">
        {!isLogin ? (
          <label className="block space-y-2 text-sm text-gray-900">
            <span className="flex items-center gap-2 font-medium"><UserRound className="h-4 w-4 text-neon-500" />Full name</span>
            <input
              type="text"
              name="name"
              value={values.name}
              onChange={onChange}
              className={controlClass}
              placeholder="Full legal name"
            />
            {errors.name ? <span className="text-xs text-red-400">{errors.name}</span> : null}
          </label>
        ) : null}

        <label className="block space-y-2 text-sm text-gray-900">
          <span className="flex items-center gap-2 font-medium"><Mail className="h-4 w-4 text-neon-500" />Email</span>
          <input
            type="email"
            name="email"
            value={values.email}
            onChange={onChange}
            className={controlClass}
            placeholder="name@example.com"
          />
          {errors.email ? <span className="text-xs text-red-400">{errors.email}</span> : null}
        </label>

        <label className="block space-y-2 text-sm text-gray-900">
          <span className="flex items-center gap-2 font-medium"><LockKeyhole className="h-4 w-4 text-neon-500" />Password</span>
          <input
            type="password"
            name="password"
            value={values.password}
            onChange={onChange}
            className={controlClass}
            placeholder="Create a secure password"
          />
          {errors.password ? <span className="text-xs text-red-400">{errors.password}</span> : null}
        </label>

        {!isLogin ? (
          <label className="block space-y-2 text-sm text-gray-900">
            <span className="flex items-center gap-2 font-medium"><Phone className="h-4 w-4 text-neon-500" />Phone</span>
            <input
              type="tel"
              name="phone"
              value={values.phone}
              onChange={onChange}
              className={controlClass}
              placeholder="10-digit Indian phone number"
            />
            {errors.phone ? <span className="text-xs text-red-400">{errors.phone}</span> : null}
          </label>
        ) : null}
      </div>

      {errors.form ? <p className="mt-4 text-sm text-red-400">{errors.form}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="secure-primary-button mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-neon-500"
      >
        {loading ? 'Please wait...' : isLogin ? 'Sign in' : 'Create account'}
      </button>

      <p className="mt-5 text-center text-sm text-white/55">
        {isLogin ? "Need an account? " : 'Already have an account? '}
        <Link to={isLogin ? '/signup' : '/login'} className="font-medium text-neon-500 hover:text-neon-400">
          {isLogin ? 'Sign up' : 'Log in'}
        </Link>
      </p>
    </motion.form>
  );
};

export default AuthForm;
