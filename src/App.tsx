import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, Edit3, Bold, Italic, Highlighter, Save, Edit2, Type, ChevronLeft, Mic } from "lucide-react";

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

const stripHtml = (html: string) => {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isMobileListView, setIsMobileListView] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
            const audioHtml = `&nbsp;<audio controls src="${base64AudioMessage}" class="my-2 max-w-full h-10 rounded-full shadow-sm"></audio>&nbsp;`;
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

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await fetch("/api/notes");
      const data = await res.json();
      setNotes(data);
      if (data.length > 0 && !selectedNoteId) {
        setSelectedNoteId(data[0].id);
        setEditTitle(data[0].title);
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch notes", error);
      setIsLoading(false);
    }
  };

  const createNote = async () => {
    try {
      const res = await fetch("/api/notes", { method: "POST" });
      const newNote = await res.json();
      setNotes([newNote, ...notes]);
      setSelectedNoteId(newNote.id);
      setEditTitle(newNote.title);
      setIsEditing(true);
      setIsMobileListView(false);
      
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();
        }
      }, 100);
    } catch (error) {
      console.error("Failed to create note", error);
    }
  };

  const updateNote = async (id: string, updates: Partial<Note>) => {
    setNotes((prev) =>
      prev
        .map((n) => (n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n))
        .sort((a, b) => b.updatedAt - a.updatedAt)
    );

    try {
      await fetch(`/api/notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch (error) {
      console.error("Failed to update note", error);
      fetchNotes();
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
      await fetch(`/api/notes/${id}`, { method: "DELETE" });
    } catch (error) {
      console.error("Failed to delete note", error);
      fetchNotes();
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

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 pb-6 custom-scrollbar">
            {isLoading ? (
              <div className="flex justify-center p-4">
                <div className="w-6 h-6 border-2 border-blue-400/50 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center text-black/50 mt-10">No notes yet.</div>
            ) : (
              <AnimatePresence>
                {notes.map((note) => (
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
                    <h3 className="font-semibold truncate pr-8 text-black text-lg">
                      {note.title || "Untitled"}
                    </h3>
                    <p className="text-sm text-black/60 truncate mt-1.5">
                      {stripHtml(note.content) || "No content"}
                    </p>
                    <button
                      onClick={(e) => deleteNote(note.id, e)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-2xl opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all bg-white/50 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
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
          <button onClick={() => setIsMobileListView(true)} className={`p-3 rounded-2xl ${glassButton}`}>
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
            {selectedNote ? (
              <motion.div
                key={selectedNote.id}
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -10 }}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                className={`w-full h-full md:rounded-3xl ${glassPanel} md:border flex flex-col overflow-hidden border-0 rounded-none`}
              >
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
                    <div className="w-px h-8 bg-black/10 mx-1 md:mx-2 flex-shrink-0" />
                    <div className="flex items-center gap-2 bg-blue-50/50 rounded-2xl px-3 py-1.5 border border-white/50 shadow-sm flex-shrink-0">
                      <Type className="w-4 h-4 text-black" />
                      <select 
                        onChange={(e) => document.execCommand('fontSize', false, e.target.value)} 
                        className="py-1 bg-transparent outline-none text-sm text-black font-medium cursor-pointer"
                        defaultValue="3"
                      >
                        <option value="1">Small</option>
                        <option value="3">Normal</option>
                        <option value="5">Large</option>
                        <option value="7">Huge</option>
                      </select>
                    </div>
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
