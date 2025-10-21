import express from "express";
import { Storage } from "megajs";

const app = express();
app.use(express.json());

// ⚠️ Substitua pelo seu email e senha do MEGA
const storage = new Storage({
  email: "zdarkmail2@gmail.com",
  password: "Morph7eus@"
});

// Espera o Storage inicializar
await storage.ready;
console.log("Conectado ao MEGA!");

// Função para buscar um termo em todos os arquivos .txt
async function buscarTermo(termo) {
  const resultados = [];

  for (const file of storage.root.children) {
    if (file.name.endsWith(".txt")) {
      try {
        // Baixa o arquivo como buffer
        const buffer = await file.downloadBuffer();
        const texto = buffer.toString("utf8");

        // Se encontrar o termo (case-insensitive)
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

// Rota principal de busca
app.get("/buscar", async (req, res) => {
  const termo = req.query.q;
  if (!termo) return res.status(400).json({ erro: "Use ?q=termo" });

  const encontrados = await buscarTermo(termo);
  res.json({
    termo,
    encontrados: encontrados.length,
    arquivos: encontrados
  });
});

// Porta
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servi

