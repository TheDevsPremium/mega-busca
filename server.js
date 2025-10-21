import express from "express";
import { Storage } from "megajs";

const app = express();
app.use(express.json());

// login no MEGA
const storage = new Storage({
  email: "zdarkmail2@gmail.com",
  password: "Morph7eus@"
});

await storage.ready;
console.log("Conectado ao MEGA!");

// rota de busca
app.get("/buscar", async (req, res) => {
  const termo = req.query.q?.toLowerCase();
  if (!termo) return res.status(400).json({ erro: "Use ?q=termo" });

  const resultados = [];

  for (const file of storage.root.children) {
    if (file.name.endsWith(".txt")) {
      const data = await file.downloadBuffer();
      const texto = data.toString("utf8");
      if (texto.toLowerCase().includes(termo)) {
        resultados.push({ arquivo: file.name });
      }
    }
  }

  res.json({ termo, encontrados: resultados.length, arquivos: resultados });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
