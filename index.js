const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

const db = require("./db");
const bcrypt = require("bcrypt");



app.post("/cliente", async (req, res) => {
    try {
        const dados = req.body;
        
        if (!dados.nome || !dados.cpf || !dados.email || !dados.celular || !dados.senha) {
            return res.status(400).json({ 
                erro: "Todos os campos são obrigatórios: nome, cpf, email, celular, senha" 
            });
        }

        const senhaCript = bcrypt.hashSync(dados.senha, 10);
        dados.senha = senhaCript;

        const resultado = await db.pool.query(
            `INSERT INTO cliente (nome, cpf, celular, email, senha) 
             VALUES (?, ?, ?, ?, ?)`,
            [dados.nome, dados.cpf, dados.celular, dados.email, dados.senha]
        );

        res.status(201).json({
            mensagem: "Cliente cadastrado com sucesso!",
            id: resultado[0].insertId
        });

    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ erro: "CPF já cadastrado no sistema" });
        }
        res.status(500).json({ erro: erro.message });
    }
});

app.get("/cliente", async (req, res) => {
    try {
        const [clientes] = await db.pool.query(
            `SELECT id, nome, cpf, celular, email 
             FROM cliente 
             ORDER BY nome`
        );
        res.status(200).json(clientes);
    } catch (erro) {
        res.status(500).json({ erro: erro.message });
    }
});

app.get("/cliente/:cpf", async (req, res) => {
    const cpf = req.params.cpf;
    
    try {
        const [cliente] = await db.pool.query(
            `SELECT id, nome, cpf, celular, email 
             FROM cliente 
             WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?`,
            [cpf]
        );

        if (cliente.length === 0) {
            return res.status(404).json({ mensagem: "Cliente não encontrado" });
        }

        res.status(200).json(cliente[0]);
    } catch (erro) {
        res.status(500).json({ erro: erro.message });
    }
});

app.put("/cliente/:cpf", async (req, res) => {
    const cpf = req.params.cpf;
    const dadosNovos = req.body;

    try {
        const [clienteExistente] = await db.pool.query(
            `SELECT * FROM cliente 
             WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?`,
            [cpf]
        );

        if (clienteExistente.length === 0) {
            return res.status(404).json({ mensagem: "Cliente não encontrado" });
        }

        if (dadosNovos.senha) {
            dadosNovos.senha = bcrypt.hashSync(dadosNovos.senha, 10);
        }
        const camposAtualizados = [];
        const valores = [];

        const camposPermitidos = ['nome', 'cpf', 'celular', 'email', 'senha'];
        for (const campo of camposPermitidos) {
            if (dadosNovos[campo] !== undefined) {
                camposAtualizados.push(`${campo} = ?`);
                valores.push(dadosNovos[campo]);
            }
        }

        if (camposAtualizados.length === 0) {
            return res.status(400).json({ 
                mensagem: "Nenhum campo válido para atualizar" 
            });
        }

        valores.push(cpf);

        const query = `
            UPDATE cliente 
            SET ${camposAtualizados.join(', ')}
            WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?
        `;

        await db.pool.query(query, valores);
        
        res.status(200).json({ 
            mensagem: "Cliente atualizado com sucesso!" 
        });

    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ erro: "CPF já cadastrado por outro cliente" });
        }
        res.status(500).json({ erro: erro.message });
    }
});

app.delete("/cliente/:cpf", async (req, res) => {
    const cpf = req.params.cpf;

    try {
        const [clienteExistente] = await db.pool.query(
            `SELECT c.*, COUNT(compra.id_venda) as total_compras
             FROM cliente c
             LEFT JOIN compra ON c.id = compra.idCliente
             WHERE REPLACE(REPLACE(REPLACE(c.cpf, '.', ''), '-', ''), ' ', '') = ?
             GROUP BY c.id`,
            [cpf]
        );

        if (clienteExistente.length === 0) {
            return res.status(404).json({ mensagem: "Cliente não encontrado" });
        }

        if (clienteExistente[0].total_compras > 0) {
            return res.status(400).json({ 
                mensagem: "Não é possível excluir cliente que possui compras registradas" 
            });
        }

        await db.pool.query(
            `DELETE FROM cliente 
             WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?`,
            [cpf]
        );

        res.status(200).json({ 
            mensagem: "Cliente excluído com sucesso!" 
        });

    } catch (erro) {
        res.status(500).json({ erro: erro.message });
    }
});


app.get("/cliente/id/:id", async (req, res) => {
    const id = req.params.id;
    
    try {
        const [cliente] = await db.pool.query(
            `SELECT id, nome, cpf, celular, email 
             FROM cliente 
             WHERE id = ?`,
            [id]
        );

        if (cliente.length === 0) {
            return res.status(404).json({ mensagem: "Cliente não encontrado" });
        }

        res.status(200).json(cliente[0]);
    } catch (erro) {
        res.status(500).json({ erro: erro.message });
    }
});

app.get("/cliente/buscar/:nome", async (req, res) => {
    const nome = req.params.nome;
    
    try {
        const [clientes] = await db.pool.query(
            `SELECT id, nome, cpf, celular, email 
             FROM cliente 
             WHERE nome LIKE ? 
             ORDER BY nome`,
            [`%${nome}%`]
        );

        if (clientes.length === 0) {
            return res.status(404).json({ mensagem: "Nenhum cliente encontrado" });
        }

        res.status(200).json(clientes);
    } catch (erro) {
        res.status(500).json({ erro: erro.message });
    }
});

app.listen(port, () => {
    console.log("API rodando na porta " + port)
})