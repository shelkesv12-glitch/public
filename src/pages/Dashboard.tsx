import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { db, Issue, UserProfile, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { 
  TrendingUp, Users, AlertCircle, CheckCircle2, 
  Filter, MoreVertical, Search, ExternalLink, Calendar, MapPin,
  UserPlus, Trash2, X, ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

export default function Dashboard({ profile }: { profile: UserProfile | null }) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('all');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [authorizedAdmins, setAuthorizedAdmins] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [showAdminManagement, setShowAdminManagement] = useState(false);

  useEffect(() => {
    const adminsRef = collection(db, 'admins');
    const unsubscribe = onSnapshot(adminsRef, (snapshot) => {
      const adminList = snapshot.docs.map(doc => doc.id);
      setAuthorizedAdmins(adminList);
    }, (error) => {
      console.warn("Could not fetch admins (expected for non-super-admins):", error.message);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const issuesRef = collection(db, 'issues');
    const q = query(issuesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const issuesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Issue[];
      setIssues(issuesList);
      setLoading(false);
      
      // Update selected issue if it was updated in real-time
      if (selectedIssue) {
        const updated = issuesList.find(i => i.id === selectedIssue.id);
        if (updated) setSelectedIssue(updated);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'issues');
    });

    return () => unsubscribe();
  }, [selectedIssue?.id]);

  const stats = [
    { label: 'Total Reports', value: issues.length, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Pending', value: issues.filter(i => i.status === 'pending').length, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'In Progress', value: issues.filter(i => i.status === 'in_progress').length, icon: Filter, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Resolved', value: issues.filter(i => i.status === 'resolved').length, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  const categoryData = Object.entries(
    issues.reduce((acc, issue) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name: name.replace('_', ' '), value }));

  const statusData = [
    { name: 'Pending', value: issues.filter(i => i.status === 'pending').length },
    { name: 'In Progress', value: issues.filter(i => i.status === 'in_progress').length },
    { name: 'Resolved', value: issues.filter(i => i.status === 'resolved').length },
    { name: 'Rejected', value: issues.filter(i => i.status === 'rejected').length },
  ];

  const handleUpdateIssue = async (issueId: string, updates: Partial<Issue>) => {
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'issues', issueId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `issues/${issueId}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail || !newAdminEmail.includes('@')) return;
    setIsUpdating(true);
    try {
      await setDoc(doc(db, 'admins', newAdminEmail.toLowerCase().trim()), {
        addedAt: serverTimestamp(),
        addedBy: profile?.email || 'system'
      });
      setNewAdminEmail("");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `admins/${newAdminEmail}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!window.confirm(`Are you sure you want to remove ${email} from authorized persons?`)) return;
    setIsUpdating(true);
    try {
      await deleteDoc(doc(db, 'admins', email));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `admins/${email}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const openIssueDetail = (issue: Issue) => {
    setSelectedIssue(issue);
    setAdminNoteInput(issue.adminNotes || "");
  };

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          issue.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || issue.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Detail Modal */}
      <AnimatePresence>
        {selectedIssue && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedIssue(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-xl font-bold text-slate-900">Issue Management</h2>
                <button 
                  onClick={() => setSelectedIssue(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <MoreVertical className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <img 
                      src={selectedIssue.imageUrl} 
                      className="w-full aspect-video object-cover rounded-3xl shadow-lg" 
                      alt="" 
                    />
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Reporter</span>
                        <span className="text-sm font-semibold">{selectedIssue.reporterName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Date</span>
                        <span className="text-sm font-semibold">
                          {selectedIssue.createdAt?.toDate ? selectedIssue.createdAt.toDate().toLocaleString() : 'Just now'}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400 shrink-0">Address</span>
                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-600 mb-2">{selectedIssue.address}</p>
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${selectedIssue.latitude},${selectedIssue.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <MapPin className="w-3 h-3" />
                            Open in Maps
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          selectedIssue.severity === 'critical' ? 'bg-red-100 text-red-600' :
                          selectedIssue.severity === 'high' ? 'bg-orange-100 text-orange-600' :
                          'bg-indigo-100 text-indigo-600'
                        }`}>
                          {selectedIssue.severity} Priority
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">{selectedIssue.title}</h3>
                      <p className="text-slate-500 leading-relaxed">{selectedIssue.description}</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-2">Update Status</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['pending', 'in_progress', 'resolved', 'rejected'].map((status) => (
                            <button
                              key={status}
                              disabled={isUpdating}
                              onClick={() => handleUpdateIssue(selectedIssue.id!, { status: status as Issue['status'] })}
                              className={`py-3 px-4 rounded-xl text-xs font-bold transition-all border ${
                                selectedIssue.status === status 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' 
                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                              } capitalize`}
                            >
                              {status.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-2">Admin Response (Notes to Citizen)</label>
                        <textarea
                          value={adminNoteInput}
                          onChange={(e) => setAdminNoteInput(e.target.value)}
                          placeholder="Type a message or internal notes..."
                          className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                        />
                        <button
                          disabled={isUpdating || adminNoteInput === selectedIssue.adminNotes}
                          onClick={() => handleUpdateIssue(selectedIssue.id!, { adminNotes: adminNoteInput })}
                          className="mt-4 w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
                        >
                          {isUpdating ? 'Saving...' : 'Update Notes'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Admin Management Modal */}
      <AnimatePresence>
        {showAdminManagement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdminManagement(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Authorized Persons</h2>
                    <p className="text-xs text-slate-500 font-medium">Manage who can access this dashboard</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAdminManagement(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block">Add New Admin</label>
                  <div className="flex gap-2">
                    <input 
                      type="email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                    />
                    <button
                      onClick={handleAddAdmin}
                      disabled={isUpdating || !newAdminEmail.includes('@')}
                      className="bg-indigo-600 text-white p-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 shrink-0"
                    >
                      <UserPlus className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block">Current Administrators</label>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {authorizedAdmins.map(email => (
                      <div key={email} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                        <span className="text-sm font-semibold text-slate-700">{email}</span>
                        <button 
                          onClick={() => handleRemoveAdmin(email)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {authorizedAdmins.length === 0 && (
                      <p className="text-center py-8 text-slate-400 text-sm italic">Only default admin configured in rules.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Authority Dashboard</h1>
          <p className="text-slate-500">Managing civic issues and field workforce</p>
        </div>
        <div className="flex items-center gap-3">
          {(profile?.email === 'shelkesv12@gmail.com' || profile?.role === 'admin') && (
            <button 
              onClick={() => setShowAdminManagement(true)}
              className="bg-white border border-slate-200 rounded-2xl px-4 py-2 flex items-center gap-2 shadow-sm hover:border-indigo-300 transition-colors text-slate-600 font-bold"
            >
              <Users className="w-5 h-5 text-indigo-600" />
              <span className="text-sm">Manage Access</span>
            </button>
          )}
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2 flex items-center gap-2 shadow-sm">
             <Calendar className="w-5 h-5 text-slate-400" />
             <span className="text-sm font-medium text-slate-600">Apr 30, 2026</span>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4"
          >
            <div className={`w-14 h-14 ${stat.bg} rounded-2xl flex items-center justify-center shrink-0`}>
              <stat.icon className={`w-7 h-7 ${stat.color}`} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Charts */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <h3 className="font-bold text-lg text-slate-900">Issue Categories</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6 flex flex-col">
          <h3 className="font-bold text-lg text-slate-900">Current Status Hub</h3>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center flex-wrap gap-4 pt-4 border-t border-slate-50">
            {statusData.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[idx]}} />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{item.name} {Math.round((item.value / issues.length) * 100) || 0}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Issues Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-bold text-xl text-slate-900">Recent Complaints</h3>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search issues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-64"
              />
            </div>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-xs font-bold uppercase tracking-widest">
                <th className="px-8 py-4">Issue</th>
                <th className="px-8 py-4">Reporter</th>
                <th className="px-8 py-4">Category</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredIssues.map((issue) => (
                <tr 
                  key={issue.id} 
                  onClick={() => openIssueDetail(issue)}
                  className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                >
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-4">
                      <img src={issue.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt="" />
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{issue.title}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[200px]">{issue.address}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <p className="text-sm font-medium text-slate-700">{issue.reporterName}</p>
                    <p className="text-xs text-slate-400">
                      {issue.createdAt?.toDate ? issue.createdAt.toDate().toLocaleDateString() : 'Just now'}
                    </p>
                  </td>
                  <td className="px-8 py-4">
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold capitalize">
                      {issue.category.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${
                         issue.status === 'resolved' ? 'bg-emerald-500' :
                         issue.status === 'in_progress' ? 'bg-amber-500' :
                         issue.status === 'pending' ? 'bg-indigo-500' : 'bg-slate-400'
                       }`} />
                       <span className="text-sm font-medium text-slate-600 capitalize">{issue.status.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          openIssueDetail(issue);
                        }}
                        className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-2 text-xs font-bold"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Manage
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredIssues.length === 0 && (
            <div className="py-20 text-center text-slate-400">
              No matching issues found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
