import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, Edit3, Bold, Italic, Highlighter, Save, Edit2, Type, ChevronLeft, Mic, X, Globe, User, Book, Lock, MoreVertical, Image as ImageIcon, Quote } from "lucide-react";
import { supabase } from "./lib/supabase";

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  isPublic?: boolean;
  authorName?: string;
}

interface UserProfile {
  name: string;
  handle: string;
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
    return saved ? JSON.parse(saved) : { name: "Anonymous", handle: "@user" };
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(notes.length > 0 ? notes[0].title : "");
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFontSizeMenuOpen, setIsFontSizeMenuOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
            const audioHtml = `&nbsp;<div contenteditable="false" class="inline-flex items-center gap-3 p-1.5 pr-4 bg-blue-50/80 backdrop-blur-md border border-blue-200/60 rounded-full shadow-sm my-2 max-w-full align-middle">
              <div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-inner flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
              </div>
              <audio controls src="${base64AudioMessage}" class="h-8 outline-none max-w-[200px] sm:max-w-xs"></audio>
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
      authorName: profile.name
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
        if (editorRef.current) {
          editorRef.current.focus();
          const imgHtml = `<br><img src="${reader.result}" class="max-w-full rounded-2xl shadow-sm my-4 border border-white/50" alt="Uploaded image" /><br>`;
          document.execCommand('insertHTML', false, imgHtml);
        }
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
  
  const displayedNotes = activeTab === 'social_notes' 
    ? notes.filter(n => n.isPublic) 
    : notes;

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
          <div className="flex items-center gap-3 font-semibold text-2xl mb-8 text-black px-2 pt-2">
            <Edit3 className="w-7 h-7" />
            notesup
          </div>
          
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
              <div className="flex justify-center p-4">
                <div className="w-6 h-6 border-2 border-blue-400/50 border-t-blue-600 rounded-full animate-spin" />
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
                          <div className="flex items-center gap-1 mt-1 text-xs font-medium text-blue-600/80">
                            <User className="w-3 h-3" />
                            {note.authorName}
                          </div>
                        )}
                      </div>
                      <div className="relative flex-shrink-0">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setActiveMenuId(activeMenuId === note.id ? null : note.id); 
                          }} 
                          className="p-1.5 hover:bg-black/5 rounded-xl transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 text-black/50" />
                        </button>
                        <AnimatePresence>
                          {activeMenuId === note.id && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute right-0 mt-1 w-36 bg-white/90 backdrop-blur-xl border border-white/50 rounded-2xl shadow-lg z-50 overflow-hidden"
                            >
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  updateNote(note.id, { isPublic: !note.isPublic, authorName: profile.name }); 
                                  setActiveMenuId(null); 
                                }} 
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 text-black font-medium flex items-center gap-2"
                              >
                                {note.isPublic ? <Lock className="w-4 h-4"/> : <Globe className="w-4 h-4"/>}
                                {note.isPublic ? 'Make Private' : 'Publish'}
                              </button>
                              <div className="w-full h-px bg-black/5" />
                              <button 
                                onClick={(e) => { deleteNote(note.id, e); setActiveMenuId(null); }} 
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 text-red-600 font-medium flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    <p className="text-sm text-black/60 truncate mt-1.5">
                      {stripHtml(note.content) || "No content"}
                    </p>
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
          <div className="flex items-center gap-2">
            {isEditing ? (
              <button onClick={handleSave} className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-medium ${glassButton}`}>
                <Save className="w-5 h-5" />
                <span>Save</span>
              </button>
            ) : (
              <button onClick={handleEdit} className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-medium ${glassButton}`}>
                <Edit2 className="w-5 h-5" />
                <span>Edit</span>
              </button>
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
                  <div className="w-20 h-20 bg-blue-200/80 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <User className="w-10 h-10 text-blue-700/70" />
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
                  
                  <div className="mt-8 p-4 bg-blue-100/50 rounded-2xl border border-blue-200/50 text-sm text-black/70 text-center">
                    Your profile and notes are now synced with Supabase! Make notes public to share them in Social Notes.
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
                <div className="hidden md:flex items-center justify-between p-8 md:p-10 pb-6 border-b border-white/40">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Note Title"
                      className="flex-1 bg-transparent text-3xl md:text-4xl font-bold outline-none placeholder:text-black/30 text-black"
                    />
                  ) : (
                    <h1 className="flex-1 text-3xl md:text-4xl font-bold text-black truncate pr-4">
                      {selectedNote.title || "Untitled"}
                    </h1>
                  )}

                  <div className="flex items-center gap-3">
                    {isEditing && (
                      <button 
                        onClick={() => updateNote(selectedNote.id, { isPublic: !selectedNote.isPublic, authorName: profile.name })}
                        className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-medium transition-all ${selectedNote.isPublic ? 'bg-green-200/70 hover:bg-green-300/80 text-green-900 shadow-sm border border-green-300/50' : glassButton}`}
                        title={selectedNote.isPublic ? "Public Note" : "Private Note"}
                      >
                        {selectedNote.isPublic ? <Globe className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                        <span className="hidden sm:inline">{selectedNote.isPublic ? 'Public' : 'Private'}</span>
                      </button>
                    )}
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
                  </div>
                </div>

                {/* Mobile Title Input/Display */}
                <div className="md:hidden p-6 pb-4 border-b border-white/20">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Note Title"
                      className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-black/30 text-black"
                    />
                  ) : (
                    <h1 className="w-full text-2xl font-bold text-black break-words">
                      {selectedNote.title || "Untitled"}
                    </h1>
                  )}
                </div>

                {/* Toolbar */}
                {isEditing && (
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
                  </div>
                )}

                {/* Editor Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                  {isEditing ? (
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
    </div>
  );
}
