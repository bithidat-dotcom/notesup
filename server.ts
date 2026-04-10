import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory data store for notes
  let notes: { id: string; title: string; content: string; updatedAt: number }[] = [
    {
      id: "1",
      title: "Welcome to Glass Notes",
      content: "This is a high-performance, full-stack notebook app with <b>smooth animations</b> and a beautiful <span style=\"background-color: #fef08a;\">glassmorphism</span> UI.<br><br>Try creating a new note or editing this one!",
      updatedAt: Date.now(),
    },
  ];

  // API Routes
  app.get("/api/notes", (req, res) => {
    res.json(notes.sort((a, b) => b.updatedAt - a.updatedAt));
  });

  app.post("/api/notes", (req, res) => {
    const newNote = {
      id: Date.now().toString(),
      title: "Untitled Note",
      content: "",
      updatedAt: Date.now(),
    };
    notes.push(newNote);
    res.json(newNote);
  });

  app.put("/api/notes/:id", (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;
    const noteIndex = notes.findIndex((n) => n.id === id);

    if (noteIndex !== -1) {
      notes[noteIndex] = {
        ...notes[noteIndex],
        title: title !== undefined ? title : notes[noteIndex].title,
        content: content !== undefined ? content : notes[noteIndex].content,
        updatedAt: Date.now(),
      };
      res.json(notes[noteIndex]);
    } else {
      res.status(404).json({ error: "Note not found" });
    }
  });

  app.delete("/api/notes/:id", (req, res) => {
    const { id } = req.params;
    notes = notes.filter((n) => n.id !== id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
