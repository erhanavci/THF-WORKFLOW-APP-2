import React, { useState } from 'react';
import { useKanbanStore } from '../hooks/useKanbanStore';
import { useToast } from '../hooks/useToast';
import { logoLight } from '../assets/logo';

const UserSignIn: React.FC = () => {
  const { signIn, signUp } = useKanbanStore();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignUp && !name)) {
        showToast("Lütfen tüm alanları doldurun.", "warning");
        return;
    }
    if (isSignUp && password.length < 6) {
        showToast("Şifre en az 6 karakter olmalıdır.", "warning");
        return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        await signUp(name, email, password);
      } else {
        await signIn(email, password);
      }
    } catch (error) {
      console.error("Sign in/up failed:", error);
      showToast("İşlem sırasında beklenmedik bir hata oluştu.", "error");
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleForm = () => {
      setIsSignUp(!isSignUp);
      setEmail('');
      setPassword('');
      setName('');
      setShowPassword(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-6 ring-1 ring-gray-200">
        <div className="text-center">
          <h1>
            <img src={logoLight} alt="THF WORKFLOW" className="mx-auto h-12 w-auto" />
            <span className="sr-only">THF WORKFLOW</span>
          </h1>
          <p className="mt-4 text-sm text-gray-600">
            {isSignUp ? "Yeni bir hesap oluşturun" : "Takım panonuza giriş yapın"}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          {isSignUp && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Ad Soyad
              </label>
              <div className="mt-1">
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm bg-gray-50"
                />
              </div>
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              E-posta Adresi
            </label>
            <div className="mt-1">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm bg-gray-50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Şifre
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm bg-gray-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 rounded-r-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500"
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a9.97 9.97 0 01-1.563 3.029m0 0l-2.14 2.14" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.522 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-sky-400 disabled:cursor-not-allowed"
            >
              {isLoading ? (isSignUp ? 'Kaydediliyor...' : 'Giriş yapılıyor...') : (isSignUp ? 'Kayıt Ol' : 'Giriş Yap')}
            </button>
          </div>
        </form>
        <div className="text-center text-sm">
            <button onClick={toggleForm} className="font-medium text-sky-600 hover:text-sky-500">
                {isSignUp ? 'Zaten bir hesabınız var mı? Giriş Yapın' : 'Hesabınız yok mu? Kayıt Olun'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default UserSignIn;
