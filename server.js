// server.js
import express from "express";
import { Storage } from "megajs";
import readline from "readline";
import stream from "stream";

const app = express();
app.use(express.json());

// ---------- CREDENCIAIS (já inseridas conforme pedido) ----------
const MEGA_EMAIL = "zdarkmail2@gmail.com";
const MEGA_PASS = "Morph7eus@";
// ------------------ fim credenciais --------------------------------

// Cria Storage com autenticação (acesso à sua conta MEGA)
const storage = new Storage({
  email: MEGA_EMAIL,
  password: MEGA_PASS,
});

await storage.ready;
console.log("Conectado ao MEGA!");

// util: normaliza termos (array, lowercased)
function buildTermsArray(termsRaw) {
  return termsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.toLowerCase());
}

// busca em linha (usado no stream/readline)
function lineHasAnyTerm(line, termsArr) {
  const lower = line.toLowerCase();
  for (const t of termsArr) {
    if (lower.includes(t)) return true;
  }
  return false;
}

// processa um readable stream linha-a-linha (retorna set de linhas com matches)
async function searchStreamByLines(readable, termsArr) {
  return new Promise((resolve, reject) => {
    const found = new Set();
    const rl = readline.createInterface({
      input: readable,
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      if (lineHasAnyTerm(line, termsArr)) {
        found.add(line.trim());
      }
    });

    rl.on("close", () => resolve(found));
    rl.on("error", (err) => reject(err));
  });
}

// fallback quando a lib retorna Buffer/string: processa texto em memória (split por linhas)
function searchTextByLines(text, termsArr) {
  const found = new Set();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (lineHasAnyTerm(line, termsArr)) found.add(line.trim());
  }
  return found;
}

// tenta baixar o arquivo do MEGA e fazer busca sem carregar tudo (prefere stream)
async function processMegaFile(fileNode, termsArr) {
  // fileNode.download() / downloadBuffer() behavior may differ by version of megajs.
  // Try fileNode.download() first — it may return a readable stream. If not, try downloadBuffer().
  try {
    const maybe = await fileNode.download(); // try promise-style download
    if (!maybe) return new Set();

    // if stream-like
    if (maybe instanceof stream.Readable || typeof maybe.pipe === "function") {
      return await searchStreamByLines(maybe, termsArr);
    }

    // if Buffer
    if (Buffer.isBuffer(maybe)) {
      return searchTextByLines(maybe.toString("utf8"), termsArr);
    }

    // if string
    if (typeof maybe === "string") {
      return searchTextByLines(maybe, termsArr);
    }

    // fallback: attempt downloadBuffer()
    const buf = await fileNode.downloadBuffer();
    if (Buffer.isBuffer(buf)) {
      return searchTextByLines(buf.toString("utf8"), termsArr);
    }

    return new Set();
  } catch (err) {
    // fallback robusto: try downloadBuffer() if available
    try {
      if (typeof fileNode.downloadBuffer === "function") {
        const buf = await fileNode.downloadBuffer();
        if (Buffer.isBuffer(buf)) {
          return searchTextByLines(buf.toString("utf8"), termsArr);
        }
      }
    } catch (err2) {
      console.error("Erro fallback downloadBuffer:", err2 && err2.message ? err2.message : err2);
    }
    console.error(`Erro ao processar arquivo ${fileNode.name}:`, err && err.message ? err.message : err);
    return new Set();
  }
}

// percorre recursivamente a árvore do storage (root) e processa arquivos .txt
async function buscarTermoRecursivo(termsRaw) {
  const termsArr = buildTermsArray(termsRaw);
  const resultados = {}; // { "caminho/nome.txt": Set([...]) }

  async function percorrer(node, pathPrefix = "") {
    const children = node.children || [];
    for (const child of children) {
      // detecta pasta vs arquivo (megajs normalmente tem .directory boolean)
      const isDir = !!child.directory;
      const nome = child.name || "(sem-nome)";
      const caminho = pathPrefix ? `${pathPrefix}/${nome}` : nome;
      if (isDir) {
        // carrega atributos/children da pasta (algumas versões exigem loadAttributes)
        try {
          if (typeof child.loadAttributes === "function") {
            await child.loadAttributes();
          }
        } catch (e) {
          // não fatal
        }
        await percorrer(child, caminho);
      } else {
        if (nome.toLowerCase().endsWith(".txt")) {
          console.log("Lendo arquivo:", caminho);
          const foundSet = await processMegaFile(child, termsArr);
          if (foundSet && foundSet.size > 0) {
            resultados[caminho] = Array.from(foundSet);
          }
        }
      }
    }
  }

  // garante que root tenha children carregadas
  try {
    if (typeof storage.root.loadAttributes === "function") {
      await storage.root.loadAttributes();
    }
  } catch (e) {
    // ignore
  }

  await percorrer(storage.root, "");
  return resultados;
}

// Rota de busca: /buscar?q=termo1,termo2
app.get("/buscar", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ erro: "Use ?q=termo1,termo2" });

    console.log("Buscando termos:", q);
    const results = await buscarTermoRecursivo(q);
    const fileNames = Object.keys(results);
    res.json({
      termo: q,
      encontrados: fileNames.length,
      arquivos: fileNames.map((f) => ({ arquivo: f, registros: results[f] })),
    });
  } catch (err) {
    console.error("Erro na busca:", err && err.message ? err.message : err);
    res.status(500).json({ erro: "Erro interno", detail: String(err && err.message ? err.message : err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
