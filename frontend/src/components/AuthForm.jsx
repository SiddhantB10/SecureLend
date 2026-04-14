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

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-glow backdrop-blur"
    >
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.35em] text-neon-500/80">Secure access</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-2 text-sm text-white/60">
          {isLogin
            ? 'Sign in to review your loan applications and monitoring status.'
            : 'Join SecureLend to apply for loans with AI risk analysis.'}
        </p>
      </div>

      <div className="space-y-4">
        {!isLogin ? (
          <label className="block space-y-2 text-sm text-white/80">
            <span className="flex items-center gap-2 font-medium"><UserRound className="h-4 w-4 text-neon-500" />Full name</span>
            <input
              type="text"
              name="name"
              value={values.name}
              onChange={onChange}
              className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-neon-500/60"
              placeholder="Amina Carter"
            />
            {errors.name ? <span className="text-xs text-red-400">{errors.name}</span> : null}
          </label>
        ) : null}

        <label className="block space-y-2 text-sm text-white/80">
          <span className="flex items-center gap-2 font-medium"><Mail className="h-4 w-4 text-neon-500" />Email</span>
          <input
            type="email"
            name="email"
            value={values.email}
            onChange={onChange}
            className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-neon-500/60"
            placeholder="you@securelend.com"
          />
          {errors.email ? <span className="text-xs text-red-400">{errors.email}</span> : null}
        </label>

        <label className="block space-y-2 text-sm text-white/80">
          <span className="flex items-center gap-2 font-medium"><LockKeyhole className="h-4 w-4 text-neon-500" />Password</span>
          <input
            type="password"
            name="password"
            value={values.password}
            onChange={onChange}
            className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-neon-500/60"
            placeholder="At least 8 characters"
          />
          {errors.password ? <span className="text-xs text-red-400">{errors.password}</span> : null}
        </label>

        {!isLogin ? (
          <label className="block space-y-2 text-sm text-white/80">
            <span className="flex items-center gap-2 font-medium"><Phone className="h-4 w-4 text-neon-500" />Phone</span>
            <input
              type="tel"
              name="phone"
              value={values.phone}
              onChange={onChange}
              className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-neon-500/60"
              placeholder="+1 555 010 4512"
            />
            {errors.phone ? <span className="text-xs text-red-400">{errors.phone}</span> : null}
          </label>
        ) : null}
      </div>

      {errors.form ? <p className="mt-4 text-sm text-red-400">{errors.form}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-full bg-neon-500 px-5 py-3 font-semibold text-black transition hover:scale-[1.01] hover:bg-neon-400 disabled:cursor-not-allowed disabled:opacity-60"
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
