import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp
} from "firebase/firestore";
import { User } from "firebase/auth";
import { db, Issue, UserProfile, handleFirestoreError, OperationType } from "../lib/firebase";
import { Plus, Clock, CheckCircle2, AlertCircle, MapPin, Camera, Sparkles, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReportIssueModal from "../components/ReportIssueModal";

interface Props {
  user: User;
  profile: UserProfile | null;
}

export default function Home({ user, profile }: Props) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'my'>('all');

  useEffect(() => {
    setLoading(true);
    const issuesRef = collection(db, 'issues');
    
    // Default query: all issues sorted by newest
    let q = query(issuesRef, orderBy('createdAt', 'desc'));

    if (filter === 'my') {
      q = query(issuesRef, where('reporterId', '==', user.uid), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const issuesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Issue[];
      setIssues(issuesList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'issues');
    });

    return () => unsubscribe();
  }, [filter, user.uid]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'pending': return <AlertCircle className="w-4 h-4 text-indigo-500" />;
      default: return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-indigo-600 rounded-[2.5rem] p-8 sm:p-12 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
        <div className="relative z-10 max-w-2xl">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl font-bold mb-4 tracking-tight leading-tight"
          >
            Spotted a problem? <br />
            <span className="text-indigo-200">Let AI handle it.</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-indigo-100 text-lg mb-8 opacity-90"
          >
            Capture potholes, garbage, or leaks. Our AI detects the issue instantly and routes it to the right department.
          </motion.p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowReportModal(true)}
            className="bg-white text-indigo-600 px-8 py-4 rounded-2xl font-bold text-lg flex items-center gap-2 shadow-xl shadow-indigo-900/20 transition-all"
          >
            <Plus className="w-6 h-6" />
            Report New Issue
          </motion.button>
        </div>
        {/* Background blobs */}
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-50" />
        <div className="absolute right-0 bottom-0 w-64 h-64 bg-purple-500 rounded-full blur-3xl opacity-30" />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${filter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            All Issues
          </button>
          <button
            onClick={() => setFilter('my')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${filter === 'my' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            My Reports
          </button>
        </div>
        <div className="text-slate-400 text-sm font-medium">
          Showing {issues.length} issues
        </div>
      </div>

      {/* Issues Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-3xl h-96 animate-pulse border border-slate-100 shadow-sm" />
          ))}
        </div>
      ) : issues.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {issues.map((issue, idx) => (
              <motion.div
                key={issue.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="relative h-56 overflow-hidden">
                  <img 
                    src={issue.imageUrl} 
                    alt={issue.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getSeverityColor(issue.severity)}`}>
                      {issue.severity}
                    </span>
                  </div>
                  <div className="absolute top-4 right-4 capitalize font-bold text-xs bg-white/90 backdrop-blur text-slate-700 px-3 py-1 rounded-full border border-white shadow-sm">
                    {issue.category.replace('_', ' ')}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-12">
                     <h3 className="text-white font-bold text-lg leading-tight line-clamp-2">{issue.title}</h3>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                      {getStatusIcon(issue.status)}
                      <span className="capitalize">{issue.status.replace('_', ' ')}</span>
                    </div>
                    <div className="text-xs text-slate-400 font-medium">
                      {issue.createdAt?.toDate ? issue.createdAt.toDate().toLocaleDateString() : 'Just now'}
                    </div>
                  </div>
                  <p className="text-slate-600 text-sm line-clamp-3 leading-relaxed">
                    {issue.description}
                  </p>
                  
                  {issue.adminNotes && (
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-start gap-3">
                      <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-indigo-900 mb-1">Response from Authority</p>
                        <p className="text-xs text-indigo-700 leading-relaxed italic">"{issue.adminNotes}"</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-50">
                    <div className="flex items-center gap-2 truncate">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-500 truncate font-medium">
                        {issue.address || 'Unknown Location'}
                      </span>
                    </div>
                    {issue.latitude && issue.longitude && (
                      <a 
                         href={`https://www.google.com/maps/search/?api=1&query=${issue.latitude},${issue.longitude}`}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="shrink-0 p-2 hover:bg-indigo-50 rounded-lg text-indigo-600 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
           <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
             <Camera className="w-10 h-10 text-slate-300" />
           </div>
           <h3 className="text-xl font-bold text-slate-900 mb-2">No issues found</h3>
           <p className="text-slate-400 max-w-xs mx-auto mb-8">
             Everything looks great! Start reporting local issues to earn points and improve your city.
           </p>
           <button 
             onClick={() => setShowReportModal(true)}
             className="text-indigo-600 font-bold hover:underline underline-offset-4"
           >
             Report an Issue
           </button>
        </div>
      )}

      {/* Modal Integration */}
      <ReportIssueModal 
        isOpen={showReportModal} 
        onClose={() => setShowReportModal(false)} 
        user={user}
        profile={profile}
      />
    </div>
  );
}
