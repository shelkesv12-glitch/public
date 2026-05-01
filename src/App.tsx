/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User 
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { auth, db, googleProvider, UserProfile } from "./lib/firebase";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import { LogIn, LayoutDashboard, Home as HomeIcon, LogOut, Award } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'citizen' | 'admin'>('citizen');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch or create profile
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        } else {
          // Default to citizen
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            role: firebaseUser.email === 'shelkesv12@gmail.com' ? 'admin' : 'citizen',
            displayName: firebaseUser.displayName || 'Anonymous Citizen',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || '',
            points: 0
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-700 to-indigo-900 flex flex-col items-center justify-center p-4 text-white">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-2xl">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/20">
              <div className="text-4xl font-bold bg-indigo-600 bg-clip-text text-transparent">C</div>
            </div>
            <h1 className="text-4xl font-bold mb-4 tracking-tight">CityFix</h1>
            <p className="text-indigo-100 mb-8 leading-relaxed">
              Report, Track, and Transform your city. Join thousands of citizens making our urban spaces better with AI.
            </p>
            <button
              onClick={handleLogin}
              className="w-full bg-white text-indigo-700 hover:bg-indigo-50 font-semibold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            >
              <LogIn className="w-5 h-5" />
              Sign in with Google
            </button>
          </div>
          <p className="mt-8 text-indigo-200/60 text-sm">
            Empowering Citizens, Transforming Cities.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 backdrop-blur-sm bg-white/80">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">CF</div>
            <span className="font-bold text-xl tracking-tight text-slate-900">CityFix</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 mr-4 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-sm font-medium">
              <Award className="w-4 h-4" />
              {profile?.points || 0} Points
            </div>
            {profile?.role === 'admin' && (
              <button
                onClick={() => setView(view === 'citizen' ? 'admin' : 'citizen')}
                className={`p-2 rounded-xl transition-colors ${view === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-500'}`}
                title={view === 'admin' ? 'Switch to App' : 'Switch to Dashboard'}
              >
                {view === 'admin' ? <HomeIcon className="w-6 h-6" /> : <LayoutDashboard className="w-6 h-6" />}
              </button>
            )}
            <div className="h-8 w-px bg-slate-200 mx-2" />
            <button
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              className="w-9 h-9 rounded-full border-2 border-white shadow-sm ml-2"
              alt={user.displayName || ''}
            />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {view === 'citizen' ? (
            <motion.div
              key="citizen"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
            >
              <Home user={user} profile={profile} />
            </motion.div>
          ) : (
            <motion.div
              key="admin"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <Dashboard profile={profile} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-8 bg-slate-50 border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
          &copy; 2026 CityFix - Smart Civic Issue Management System
        </div>
      </footer>
    </div>
  );
}
