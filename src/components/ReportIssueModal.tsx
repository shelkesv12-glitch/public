import { useState, useRef } from "react";
import { 
  collection, 
  addDoc, 
  serverTimestamp,
  doc,
  updateDoc,
  increment
} from "firebase/firestore";
import { User } from "firebase/auth";
import { db, UserProfile, handleFirestoreError, OperationType } from "../lib/firebase";
import { analyzeCivicIssue } from "../services/aiService";
import { 
  X, 
  Camera, 
  Upload, 
  MapPin, 
  Sparkles, 
  Loader2, 
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  profile: UserProfile | null;
}

export default function ReportIssueModal({ isOpen, onClose, user, profile }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(1);
    setImage(null);
    setAiResult(null);
    setLocation(null);
    setAnalyzing(false);
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setImage(compressed);
        processImage(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const compressImage = (base64: string, maxWidth = 1000, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    });
  };

  const processImage = async (base64: string) => {
    setAnalyzing(true);
    setStep(2);
    
    // Get location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }

    try {
      const result = await analyzeCivicIssue(base64);
      setAiResult(result);
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!aiResult || !user) return;
    setSubmitting(true);

    try {
      const issueData = {
        title: aiResult.title || "Reported Issue",
        description: aiResult.description || "",
        category: aiResult.category || "other",
        severity: aiResult.severity || "medium",
        status: "pending" as const,
        imageUrl: image,
        latitude: location?.lat || 0,
        longitude: location?.lng || 0,
        reporterId: user.uid,
        reporterName: user.displayName || "Anonymous",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'issues'), issueData);
      
      // Award points
      await updateDoc(doc(db, 'users', user.uid), {
        points: increment(10)
      });

      handleClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'issues');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Report Civic Issue</h2>
            <p className="text-slate-400 text-sm">Powered by CityFix AI</p>
          </div>
          <button 
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="group aspect-video w-full rounded-3xl border-2 border-dashed border-indigo-100 bg-indigo-50/50 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                >
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 group-hover:scale-110 transition-transform">
                    <Camera className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-indigo-900">Take Live Photo or Upload</p>
                    <p className="text-indigo-400 text-sm">Tap here to open camera</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    className="hidden" 
                    accept="image/*"
                    capture="environment"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-2" />
                    <p className="text-sm font-bold text-slate-700">AI Detection</p>
                    <p className="text-xs text-slate-400">Automatic classification of issues</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <MapPin className="w-5 h-5 text-amber-500 mb-2" />
                    <p className="text-sm font-bold text-slate-700">Geotagging</p>
                    <p className="text-xs text-slate-400">Automatic GPS location capture</p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="relative aspect-video w-full rounded-3xl overflow-hidden ring-4 ring-indigo-50">
                  <img src={image!} alt="Preview" className="w-full h-full object-cover" />
                  {analyzing && (
                    <div className="absolute inset-0 bg-indigo-900/40 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                      <Loader2 className="w-10 h-10 animate-spin mb-4" />
                      <p className="font-bold text-lg animate-pulse">AI is analyzing issue...</p>
                    </div>
                  )}
                </div>

                {!analyzing && aiResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                        <span className="font-bold text-slate-900 text-lg">{aiResult.found ? 'Issue Detected' : 'Review Information'}</span>
                      </div>
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${
                        aiResult.severity === 'critical' ? 'bg-red-500 text-white' :
                        aiResult.severity === 'high' ? 'bg-orange-500 text-white' :
                        'bg-indigo-500 text-white'
                      }`}>
                        {aiResult.severity} Priority
                      </span>
                    </div>

                    {!aiResult.found && (
                      <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl text-amber-800 border border-amber-100">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <p className="text-sm font-medium">AI couldn't clearly identify a civic issue. Please provide a clear photo.</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-slate-900 font-bold">{aiResult.title}</p>
                      <p className="text-slate-500 text-sm leading-relaxed">{aiResult.description}</p>
                    </div>

                    <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
                      <div className="flex items-center gap-2 text-slate-500">
                        <MapPin className="w-4 h-4" />
                        <span className="text-xs font-medium">GPS Captured</span>
                      </div>
                      <div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold capitalize">
                        {aiResult.category?.replace('_', ' ')}
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep(1)}
                    disabled={submitting}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 px-6 rounded-2xl transition-all disabled:opacity-50"
                  >
                    Retake Photo
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || analyzing || !aiResult?.found}
                    className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    {submitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
