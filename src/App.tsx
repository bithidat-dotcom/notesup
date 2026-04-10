import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, Edit3, Bold, Italic, Highlighter, Save, Edit2, Type, ChevronLeft, Mic, X, Globe, User, Book, Lock, MoreVertical, Image as ImageIcon, Quote, Search, Camera } from "lucide-react";
import { supabase } from "./lib/supabase";
import Cropper from 'react-easy-crop';
import { getCroppedImg } from './lib/cropImage';

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  isPublic?: boolean;
  authorName?: string;
  authorId?: string;
  authorAvatar?: string;
  bannerColor?: string;
}

interface UserProfile {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
}

const stripHtml = (html: string) => {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

export default function App() {
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem("notesup_data");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse notes from local storage", e);
      }
    }
    return [
      {
        id: "1",
        title: "Welcome to notesup",
        content: "Try creating a new note, editing this one, or recording a voice message!",
        updatedAt: Date.now(),
      }
    ];
  });
  
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(notes.length > 0 ? notes[0].id : null);
  const [isMobileListView, setIsMobileListView] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'my_notes' | 'social_notes' | 'profile'>('my_notes');
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem("notesup_profile");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.id) parsed.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
      return parsed;
    }
    return { id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(), name: "Anonymous", handle: "@user" };
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(notes.length > 0 ? notes[0].title : "");
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFontSizeMenuOpen, setIsFontSizeMenuOpen] = useState(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Save and sync with Supabase whenever notes change
  useEffect(() => {
    localStorage.setItem("notesup_data", JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem("notesup_profile", JSON.stringify(profile));
  }, [profile]);

  // Initial fetch from Supabase
  useEffect(() => {
    const fetchNotes = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .order('updatedAt', { ascending: false });
          
        if (error) throw error;
        
        if (data && data.length > 0) {
          setNotes(data);
          if (!selectedNoteId) {
            setSelectedNoteId(data[0].id);
            setEditTitle(data[0].title);
          }
        }
      } catch (err) {
        console.error("Supabase fetch failed, falling back to local storage:", err);
        // Fallback is already handled by the initial state from localStorage
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchNotes();

    // Realtime Subscription
    const channel = supabase
      .channel('public:notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setNotes(prev => {
            if (prev.find(n => n.id === payload.new.id)) return prev;
            return [payload.new as Note, ...prev].sort((a, b) => b.updatedAt - a.updatedAt);
          });
        } else if (payload.eventType === 'UPDATE') {
          setNotes(prev => prev.map(n => n.id === payload.new.id ? payload.new as Note : n).sort((a, b) => b.updatedAt - a.updatedAt));
        } else if (payload.eventType === 'DELETE') {
          setNotes(prev => prev.filter(n => n.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const toggleVoiceRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64AudioMessage = reader.result as string;
          if (editorRef.current) {
            editorRef.current.focus();
            const audioHtml = `&nbsp;<div contenteditable="false" class="inline-flex items-center gap-2 p-2 pr-4 bg-white/80 backdrop-blur-xl border border-white shadow-lg rounded-2xl my-3 max-w-full align-middle">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-md flex-shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
              </div>
              <div class="flex flex-col justify-center">
                <span class="text-[10px] font-bold text-blue-900/50 uppercase tracking-wider ml-3 mb-0.5">Voice Note</span>
                <audio controls controlsList="nodownload noplaybackrate" src="${base64AudioMessage}" class="h-8 outline-none max-w-[200px] sm:max-w-xs"></audio>
              </div>
            </div>&nbsp;`;
            document.execCommand('insertHTML', false, audioHtml);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const createNote = async () => {
    const newNote = {
      id: Date.now().toString(),
      title: "Untitled Note",
      content: "",
      updatedAt: Date.now(),
      isPublic: false,
      authorName: profile.name,
      authorId: profile.id,
      authorAvatar: profile.avatarUrl,
      bannerColor: "from-blue-50/50 to-indigo-50/50"
    };
    
    setNotes([newNote, ...notes]);
    setSelectedNoteId(newNote.id);
    setEditTitle(newNote.title);
    setIsEditing(true);
    setIsMobileListView(false);
    
    try {
      await supabase.from('notes').insert([newNote]);
    } catch (err) {
      console.error("Failed to save to Supabase:", err);
    }
    
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
      }
    }, 100);
  };

  const updateNote = async (id: string, updates: Partial<Note>) => {
    const updatedNote = { ...notes.find(n => n.id === id), ...updates, updatedAt: Date.now() } as Note;
    
    setNotes((prev) =>
      prev
        .map((n) => (n.id === id ? updatedNote : n))
        .sort((a, b) => b.updatedAt - a.updatedAt)
    );

    try {
      await supabase.from('notes').upsert(updatedNote);
    } catch (err) {
      console.error("Failed to update in Supabase:", err);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropImageSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropConfirm = async () => {
    if (cropImageSrc && croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedImg(cropImageSrc, croppedAreaPixels);
        if (editorRef.current) {
          editorRef.current.focus();
          const imgHtml = `<br><img src="${croppedImage}" class="max-w-full rounded-2xl shadow-sm my-4 border border-black/10" alt="Uploaded image" /><br>`;
          document.execCommand('insertHTML', false, imgHtml);
        }
      } catch (e) {
        console.error(e);
      }
    }
    setCropImageSrc(null);
  };

  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile({ ...profile, avatarUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedNoteId === id) {
      const remaining = notes.filter((n) => n.id !== id);
      if (remaining.length > 0) {
        setSelectedNoteId(remaining[0].id);
        setEditTitle(remaining[0].title);
        setIsEditing(false);
      } else {
        setSelectedNoteId(null);
      }
    }

    try {
      await supabase.from('notes').delete().eq('id', id);
    } catch (err) {
      console.error("Failed to delete from Supabase:", err);
    }
  };

  const handleSelectNote = (id: string) => {
    setSelectedNoteId(id);
    setIsMobileListView(false);
    setIsEditing(false);
    const note = notes.find(n => n.id === id);
    if (note) setEditTitle(note.title);
  };

  const handleSave = () => {
    if (selectedNoteId) {
      const content = editorRef.current?.innerHTML || "";
      updateNote(selectedNoteId, { title: editTitle, content });
      setIsEditing(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
      }
    }, 100);
  };

  const selectedNote = notes.find((n) => n.id === selectedNoteId);
  const isMyNote = selectedNote ? selectedNote.authorId === profile.id : false;
  
  const displayedNotes = (activeTab === 'social_notes' 
    ? notes.filter(n => n.isPublic) 
    : notes).filter(n => 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (n.authorName && n.authorName.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  // Glassmorphism classes
  const glassPanel = "bg-white/60 backdrop-blur-2xl border border-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.06)]";
  // Soft blue button
  const glassButton = "bg-blue-200/60 hover:bg-blue-300/70 backdrop-blur-md border border-white/60 shadow-sm transition-all duration-300 text-black";
  const iconButton = "p-2.5 rounded-2xl bg-blue-100/50 hover:bg-blue-200/70 backdrop-blur-md border border-white/50 transition-all text-black shadow-sm flex-shrink-0";

  return (
    <div className="h-screen w-full flex overflow-hidden bg-gradient-to-br from-[#e6f0fa] via-[#eef0fc] to-[#f8ebf8] text-black font-sans">
      
      {/* Sidebar (List View on Mobile) */}
      <div
        className={`
          ${isMobileListView ? "flex" : "hidden"} md:flex
          w-full md:w-80 h-full flex-shrink-0 flex-col
          ${glassPanel} md:border-r md:border-y-0 md:border-l-0 md:rounded-none
        `}
      >
        <div className="p-6 flex-1 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8 px-2 pt-2">
            <div className="flex items-center gap-3 font-semibold text-2xl text-black">
              <Edit3 className="w-7 h-7" />
              notesup
            </div>
            <button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 rounded-full hover:bg-white/40 transition-colors text-black/70"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
          
          <AnimatePresence>
            {isSearchOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                animate={{ height: 'auto', opacity: 1, marginBottom: 24 }}
                exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
                  <input 
                    type="text" 
                    placeholder="Search notes or users..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/50 border border-white/60 rounded-2xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-400/50 transition-all text-black text-sm font-medium placeholder:text-black/40"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X className="w-4 h-4 text-black/40 hover:text-black/70" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={createNote}
            className={`w-full py-4 px-4 rounded-3xl flex items-center justify-center gap-2 font-medium mb-6 ${glassButton}`}
          >
            <Plus className="w-5 h-5" />
            New Note
          </motion.button>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 pb-4 custom-scrollbar">
            {isLoading ? (
              <div className="flex flex-col gap-3 p-2">
                {[1, 2, 3, 4].map((i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-5 rounded-3xl bg-white/30 border border-white/40 h-28 animate-pulse flex flex-col justify-between"
                  >
                    <div className="w-2/3 h-5 bg-black/10 rounded-full" />
                    <div className="w-full h-3 bg-black/5 rounded-full mt-4" />
                    <div className="w-4/5 h-3 bg-black/5 rounded-full mt-2" />
                  </motion.div>
                ))}
              </div>
            ) : displayedNotes.length === 0 ? (
              <div className="text-center text-black/50 mt-10 px-4">
                {activeTab === 'social_notes' 
                  ? "No public notes yet. Make a note public to see it here!" 
                  : "No notes yet."}
              </div>
            ) : (
              <AnimatePresence>
                {displayedNotes.map((note) => (
                  <motion.div
                    key={note.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectNote(note.id)}
                    className={`
                      p-5 rounded-3xl cursor-pointer relative group transition-all duration-300
                      ${selectedNoteId === note.id 
                        ? "bg-blue-100/70 shadow-md border border-white/80" 
                        : "bg-white/30 hover:bg-white/50 border border-white/40"}
                    `}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate pr-4 text-black text-lg">
                          {note.title || "Untitled"}
                        </h3>
                        {activeTab === 'social_notes' && note.authorName && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs font-medium text-blue-600/80">
                            {note.authorAvatar ? (
                              <img src={note.authorAvatar} alt={note.authorName} className="w-4 h-4 rounded-full object-cover" />
                            ) : (
                              <User className="w-3 h-3" />
                            )}
                            {note.authorName}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-black/60 truncate mt-1.5">
                      {stripHtml(note.content) || "No content"}
                    </p>
                    {note.authorId === profile.id && (
                      <button
                        onClick={(e) => deleteNote(note.id, e)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-2xl opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all bg-white/50 shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Sidebar Bottom Navigation */}
          <div className="pt-4 mt-auto border-t border-white/40 flex flex-row justify-around items-center px-2">
            <button
              onClick={() => { setActiveTab('my_notes'); setIsMobileListView(true); }}
              className={`p-3.5 rounded-2xl transition-all flex-1 flex justify-center mx-1 ${activeTab === 'my_notes' ? 'bg-blue-200/80 text-blue-900 shadow-sm' : 'hover:bg-white/40 text-black/60'}`}
              title="My Notes"
            >
              <Book className="w-6 h-6" />
            </button>
            <button
              onClick={() => { setActiveTab('social_notes'); setIsMobileListView(true); }}
              className={`p-3.5 rounded-2xl transition-all flex-1 flex justify-center mx-1 ${activeTab === 'social_notes' ? 'bg-blue-200/80 text-blue-900 shadow-sm' : 'hover:bg-white/40 text-black/60'}`}
              title="Social Notes"
            >
              <Globe className="w-6 h-6" />
            </button>
            <button
              onClick={() => { setActiveTab('profile'); setIsMobileListView(false); }}
              className={`p-3.5 rounded-2xl transition-all flex-1 flex justify-center mx-1 ${activeTab === 'profile' ? 'bg-blue-200/80 text-blue-900 shadow-sm' : 'hover:bg-white/40 text-black/60'}`}
              title="Profile"
            >
              <User className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Editor Area (Editor View on Mobile) */}
      <div 
        className={`
          ${!isMobileListView ? "flex" : "hidden"} md:flex
          flex-1 h-full flex-col overflow-hidden
        `}
      >
        {/* Mobile Editor Header */}
        <div className={`md:hidden flex items-center justify-between p-4 border-b border-white/40 ${glassPanel} rounded-none border-x-0 border-t-0 z-10`}>
          <button onClick={() => { setIsMobileListView(true); if (activeTab === 'profile') setActiveTab('my_notes'); }} className={`p-3 rounded-2xl ${glassButton}`}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <div className="flex-1 px-3">
            {isSearchOpen && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/50 border border-white/60 rounded-2xl pl-9 pr-4 py-2 outline-none focus:ring-2 focus:ring-blue-400/50 transition-all text-black text-sm font-medium placeholder:text-black/40"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className={`p-3 rounded-2xl ${glassButton}`}
            >
              <Search className="w-5 h-5" />
            </button>
            {isMyNote && (
              <>
                {isEditing ? (
                  <button onClick={handleSave} className={`p-3 rounded-2xl ${glassButton}`}>
                    <Save className="w-5 h-5" />
                  </button>
                ) : (
                  <button onClick={handleEdit} className={`p-3 rounded-2xl ${glassButton}`}>
                    <Edit2 className="w-5 h-5" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex-1 p-0 md:p-8 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'profile' ? (
              <motion.div
                key="profile-view"
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -10 }}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                className={`w-full h-full md:rounded-3xl ${glassPanel} md:border flex flex-col items-center justify-center p-6 border-0 rounded-none overflow-y-auto`}
              >
                <div className="w-full max-w-md bg-white/40 backdrop-blur-xl p-8 rounded-3xl border border-white/50 shadow-sm">
                  <div className="relative w-24 h-24 mx-auto mb-6 group cursor-pointer" onClick={() => profileInputRef.current?.click()}>
                    {profile.avatarUrl ? (
                      <img src={profile.avatarUrl} alt="Profile" className="w-full h-full rounded-full object-cover shadow-inner border-2 border-white" />
                    ) : (
                      <div className="w-full h-full bg-blue-200/80 rounded-full flex items-center justify-center shadow-inner border-2 border-white">
                        <User className="w-12 h-12 text-blue-700/70" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                    <input type="file" accept="image/*" ref={profileInputRef} className="hidden" onChange={handleProfileImageUpload} />
                  </div>
                  <h2 className="text-2xl font-bold text-center mb-8 text-black">Your Profile</h2>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-black/70 mb-2">Display Name</label>
                      <input 
                        type="text" 
                        value={profile.name}
                        onChange={(e) => setProfile({...profile, name: e.target.value})}
                        className="w-full bg-white/50 border border-white/60 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-400/50 transition-all text-black font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-black/70 mb-2">Username / Handle</label>
                      <input 
                        type="text" 
                        value={profile.handle}
                        onChange={(e) => setProfile({...profile, handle: e.target.value})}
                        className="w-full bg-white/50 border border-white/60 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-400/50 transition-all text-black font-medium"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : selectedNote ? (
              <motion.div
                key={selectedNote.id}
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -10 }}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                className={`w-full h-full md:rounded-3xl ${glassPanel} md:border flex flex-col overflow-hidden border-0 rounded-none relative`}
              >
                {/* Recording Animation Overlay */}
                <AnimatePresence>
                  {isRecording && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20, scale: 0.9 }} 
                      animate={{ opacity: 1, y: 0, scale: 1 }} 
                      exit={{ opacity: 0, y: 20, scale: 0.9 }}
                      className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 z-50 border border-red-400/50"
                    >
                      <div className="flex gap-1.5 items-center h-6">
                        <span className="w-1.5 h-full bg-white rounded-full animate-[bounce_1s_infinite_0ms]" />
                        <span className="w-1.5 h-2/3 bg-white rounded-full animate-[bounce_1s_infinite_200ms]" />
                        <span className="w-1.5 h-full bg-white rounded-full animate-[bounce_1s_infinite_400ms]" />
                        <span className="w-1.5 h-1/2 bg-white rounded-full animate-[bounce_1s_infinite_600ms]" />
                      </div>
                      <span className="font-semibold tracking-wide">Recording...</span>
                      <button 
                        onClick={toggleVoiceRecording} 
                        className="ml-2 bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Desktop Header */}
                <div className={`hidden md:flex items-center justify-between p-8 md:p-10 pb-6 border-b border-white/40 bg-gradient-to-r ${selectedNote.bannerColor || 'from-transparent to-transparent'}`}>
                  <div className="flex-1 min-w-0 mr-4">
                    {isEditing && isMyNote ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Note Title"
                        className="w-full bg-transparent text-3xl md:text-4xl font-bold outline-none placeholder:text-black/30 text-black mb-2"
                      />
                    ) : (
                      <h1 className="w-full text-3xl md:text-4xl font-bold text-black truncate mb-2">
                        {selectedNote.title || "Untitled"}
                      </h1>
                    )}
                    
                    {/* Author Profile Info */}
                    {(selectedNote.authorName || selectedNote.authorAvatar) && (
                      <div className="flex items-center gap-2 text-sm font-medium text-black/60">
                        {selectedNote.authorAvatar ? (
                          <img src={selectedNote.authorAvatar} alt={selectedNote.authorName} className="w-6 h-6 rounded-full object-cover border border-white/50 shadow-sm" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center border border-white/50 shadow-sm">
                            <User className="w-3 h-3 text-black/50" />
                          </div>
                        )}
                        <span>{selectedNote.authorName || 'Anonymous'}</span>
                        <span className="text-black/30">•</span>
                        <span>{new Date(selectedNote.updatedAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {isMyNote && (
                      <>
                        <button 
                          onClick={() => updateNote(selectedNote.id, { isPublic: !selectedNote.isPublic, authorName: profile.name, authorAvatar: profile.avatarUrl })}
                          className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-medium transition-all ${selectedNote.isPublic ? 'bg-green-200/70 hover:bg-green-300/80 text-green-900 shadow-sm border border-green-300/50' : glassButton}`}
                          title={selectedNote.isPublic ? "Published to Social" : "Share to Social"}
                        >
                          {selectedNote.isPublic ? <Globe className="w-5 h-5" /> : <Globe className="w-5 h-5 opacity-50" />}
                          <span className="hidden sm:inline">{selectedNote.isPublic ? 'Published' : 'Share'}</span>
                        </button>

                        {isEditing ? (
                          <button onClick={handleSave} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-medium ${glassButton}`}>
                            <Save className="w-5 h-5" />
                            <span>Save</span>
                          </button>
                        ) : (
                          <button onClick={handleEdit} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-medium ${glassButton}`}>
                            <Edit2 className="w-5 h-5" />
                            <span>Edit</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Mobile Title Input/Display */}
                <div className={`md:hidden p-6 pb-4 border-b border-white/20 bg-gradient-to-r ${selectedNote.bannerColor || 'from-transparent to-transparent'}`}>
                  {isEditing && isMyNote ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Note Title"
                      className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-black/30 text-black mb-2"
                    />
                  ) : (
                    <h1 className="w-full text-2xl font-bold text-black break-words mb-2">
                      {selectedNote.title || "Untitled"}
                    </h1>
                  )}
                  
                  {/* Author Profile Info */}
                  {(selectedNote.authorName || selectedNote.authorAvatar) && (
                    <div className="flex items-center gap-2 text-xs font-medium text-black/60">
                      {selectedNote.authorAvatar ? (
                        <img src={selectedNote.authorAvatar} alt={selectedNote.authorName} className="w-5 h-5 rounded-full object-cover border border-white/50 shadow-sm" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-white/50 flex items-center justify-center border border-white/50 shadow-sm">
                          <User className="w-3 h-3 text-black/50" />
                        </div>
                      )}
                      <span>{selectedNote.authorName || 'Anonymous'}</span>
                      <span className="text-black/30">•</span>
                      <span>{new Date(selectedNote.updatedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Toolbar */}
                {isEditing && isMyNote && (
                  <div className="flex items-center gap-3 px-4 md:px-10 py-3 md:py-4 bg-white/30 border-b border-white/40 overflow-x-auto custom-scrollbar">
                    <button 
                      onClick={toggleVoiceRecording} 
                      className={`p-2.5 rounded-2xl backdrop-blur-md border border-white/50 transition-all shadow-sm flex-shrink-0 ${isRecording ? 'bg-red-200/80 text-red-600 animate-pulse hover:bg-red-300/80' : 'bg-blue-100/50 hover:bg-blue-200/70 text-black'}`} 
                      title={isRecording ? "Stop Recording" : "Record Voice Message"}
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                    <div className="w-px h-8 bg-black/10 mx-1 md:mx-2 flex-shrink-0" />
                    <button onClick={() => document.execCommand('bold')} className={iconButton} title="Bold">
                      <Bold className="w-5 h-5" />
                    </button>
                    <button onClick={() => document.execCommand('italic')} className={iconButton} title="Italic">
                      <Italic className="w-5 h-5" />
                    </button>
                    <button onClick={() => document.execCommand('backColor', false, '#fef08a')} className={iconButton} title="Highlight">
                      <Highlighter className="w-5 h-5" />
                    </button>
                    <button onClick={() => document.execCommand('formatBlock', false, 'blockquote')} className={iconButton} title="Quote / Reply">
                      <Quote className="w-5 h-5" />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className={iconButton} title="Insert Image">
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                    <div className="w-px h-8 bg-black/10 mx-1 md:mx-2 flex-shrink-0" />
                    {isFontSizeMenuOpen ? (
                      <div className="flex items-center gap-1 bg-blue-50/50 rounded-2xl px-1 py-1 border border-white/50 shadow-sm flex-shrink-0">
                        {[
                          { label: 'Small', value: '1' },
                          { label: 'Normal', value: '3' },
                          { label: 'Large', value: '5' },
                          { label: 'Huge', value: '7' },
                        ].map((size) => (
                          <button
                            key={size.value}
                            onClick={() => {
                              document.execCommand('fontSize', false, size.value);
                              setIsFontSizeMenuOpen(false);
                            }}
                            className="px-3 py-1.5 text-sm text-black font-medium hover:bg-white/60 rounded-xl transition-colors whitespace-nowrap"
                          >
                            {size.label}
                          </button>
                        ))}
                        <button 
                          onClick={() => setIsFontSizeMenuOpen(false)}
                          className="p-1.5 hover:bg-black/5 rounded-xl ml-1 transition-colors"
                        >
                          <X className="w-4 h-4 text-black/50" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setIsFontSizeMenuOpen(true)}
                        className="flex items-center gap-2 bg-blue-50/50 rounded-2xl px-3 py-1.5 border border-white/50 shadow-sm flex-shrink-0 hover:bg-blue-100/50 transition-colors"
                      >
                        <Type className="w-4 h-4 text-black" />
                        <span className="text-sm text-black font-medium">Size</span>
                      </button>
                    )}

                    <div className="w-px h-8 bg-black/10 mx-1 md:mx-2 flex-shrink-0" />
                    
                    {isColorMenuOpen ? (
                      <div className="flex items-center gap-1 bg-blue-50/50 rounded-2xl px-1 py-1 border border-white/50 shadow-sm flex-shrink-0">
                        {[
                          { color: 'from-blue-50/50 to-indigo-50/50', bg: 'bg-blue-200' },
                          { color: 'from-rose-50/50 to-orange-50/50', bg: 'bg-rose-200' },
                          { color: 'from-emerald-50/50 to-teal-50/50', bg: 'bg-emerald-200' },
                          { color: 'from-purple-50/50 to-pink-50/50', bg: 'bg-purple-200' },
                          { color: 'from-amber-50/50 to-yellow-50/50', bg: 'bg-amber-200' },
                        ].map((theme, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              updateNote(selectedNote.id, { bannerColor: theme.color });
                              setIsColorMenuOpen(false);
                            }}
                            className={`w-8 h-8 rounded-full ${theme.bg} border-2 border-white/80 shadow-sm hover:scale-110 transition-transform`}
                          />
                        ))}
                        <button 
                          onClick={() => setIsColorMenuOpen(false)}
                          className="p-1.5 hover:bg-black/5 rounded-xl ml-1 transition-colors"
                        >
                          <X className="w-4 h-4 text-black/50" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setIsColorMenuOpen(true)}
                        className="flex items-center gap-2 bg-blue-50/50 rounded-2xl px-3 py-1.5 border border-white/50 shadow-sm flex-shrink-0 hover:bg-blue-100/50 transition-colors"
                      >
                        <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-400 to-purple-400" />
                        <span className="text-sm text-black font-medium">Banner</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Editor Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                  {isEditing && isMyNote ? (
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      className="w-full min-h-full outline-none text-lg md:text-xl text-black editor-content pb-32"
                      dangerouslySetInnerHTML={{ __html: selectedNote.content }}
                    />
                  ) : (
                    <div 
                      className="w-full text-lg md:text-xl text-black editor-content pb-32"
                      dangerouslySetInnerHTML={{ __html: selectedNote.content || '<p class="text-black/40">No content</p>' }}
                    />
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full flex items-center justify-center text-black/50 text-lg font-medium"
              >
                Select or create a note to begin
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Image Cropper Modal */}
      <AnimatePresence>
        {cropImageSrc && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl overflow-hidden w-full max-w-2xl shadow-2xl flex flex-col">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-lg">Edit Image</h3>
                <button onClick={() => setCropImageSrc(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative w-full h-[50vh] bg-gray-900">
                <Cropper
                  image={cropImageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={4 / 3}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>
              <div className="p-6 bg-gray-50 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-500">Zoom</span>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div className="flex justify-end gap-3 mt-2">
                  <button onClick={() => setCropImageSrc(null)} className="px-6 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleCropConfirm} className="px-6 py-2.5 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-md transition-colors">
                    Insert Image
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
