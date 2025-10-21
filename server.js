import express from "express";
import { Storage } from "megajs";

const app = express();
app.use(express.json());

const storage = new Storage({
  email: "zdarkmail2@gmail.com",
  password: "Morph7eus@"
});

await storage.ready;
console.log("Conectado ao MEGA!");

async function buscarTermo(termo) {
  const resultados = [];
  for (const file of storage.root.children) {
    if (file.name.endsWith(".txt")) {
      try {
        const buffer = await file.downloadBuffer();
        const texto = buffer.toString("utf8");
        if (texto.toLowerCase().includes(termo.toLowerCase())) {
          resultados.push({ arquivo: file.name });
        }
      } catch (err) {
        console.error(`Erro ao baixar ${file.name}:`, err.message);
      }
    }
  }
  return resultados;
}

app.get("/buscar", async (req, res) => {
  const termo = req.query.q;
  if (!termo) return res.status(400).json({ erro: "Use ?q=termo" });

  const encontrados = await buscarTermo(termo);
  res.json({ termo, encontrados: encontrados.length, arquivos: encontrados });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
