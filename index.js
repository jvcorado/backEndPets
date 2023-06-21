const express = require("express"); //backend geral
const app = express();
const router = express.Router(); //rotas de controle
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mysql = require("mysql");
const cors = require("cors"); // mecanismo de segurança
const multer = require("multer"); //foto
const path = require("path"); //foto
const nodemailer = require("nodemailer"); //integração smtp email
const bodyParser = require("body-parser");
const AWS = require("aws-sdk");
const multerS3 = require("multer-s3");
const fs = require("fs");
const { S3 } = require("@aws-sdk/client-s3");
const port = process.env.PORT || 4000;
require("dotenv").config();

const db = mysql.createPool({
  host: "vps-5528980.bmouseproductions.com",
  user: "petsmellon_bm2023",
  password: "Ae@125445364",
  database: "petsmellon_site2023",
});

const s3 = new S3({
  region: "us-east-1",
  credentials: {
    accessKeyId: "AKIATSR3CWEZ2URKJDCU",
    secretAccessKey: "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",
  },
});

const storage = multerS3({
  s3: s3,
  bucket: "pets-mellon",
  //acl: "public-read",
  key: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

app.use("/uploads", express.static("uploads")); //criando a pasta caso eu nao tenha
app.use(express.json());
app.use(cors());
/* app.use(bodyParser.urlencoded({ extended: true })); */
// Middleware para tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      stack: err.stacktrace,
    },
  });
});

app.post("/blog", upload.single("image"), async (req, res) => {
  const { title, conteudo, url_amigavel } = req.body;

  if (!req.file) {
    throw Error("Arquivo não encontrado.");
  }

  const image = req.file.location; //onde sera feito o upload da imagem

  const post_day = new Date().toISOString().slice(0, 10);
  console.log({ title, url_amigavel, conteudo, image, post_day });

  try {
    const result = await db.query(
      "INSERT INTO blog (image, title, url_amigavel, conteudo, post_day, uuid) VALUES (?, ?, ?, ?, ?, UUID())",
      [image, title, url_amigavel, conteudo, post_day]
    );

    res.status(201).send({ msg: "Blog post added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Error processing request" });
  }
});

app.get("/blog", async (req, res) => {
  try {
    db.query("SELECT * FROM blog", (err, results) => {
      if (err) {
        console.error(err);
        res.status(500).send({ msg: "Error processing request" });
        return;
      }

      // Modify the response to include the S3 URL to the uploaded image
      const blogPosts = results.map((post) => ({
        uuid: post.uuid,
        image: post.image, // Add the S3 URL to the photo
        conteudo: post.conteudo,
        url_amigavel: post.url_amigavel,
        title: post.title,
        post_day: new Date(post.post_day).toLocaleDateString("pt-BR", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
      }));

      res.status(200).send(blogPosts);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ msg: "Error processing request" });
  }
});

app.get("/blog/:url_amigavel", async (req, res) => {
  try {
    const url_amigavel = req.params.url_amigavel;
    db.query(
      "SELECT * FROM blog WHERE url_amigavel=?",
      [url_amigavel],
      (err, results) => {
        if (err) {
          console.error(err);
          res.status(500).send({ msg: "Error processing request" });
          return;
        }
        if (results.length === 0) {
          res.status(404).send({ msg: "Blog post not found" });
          return;
        }
        const blogPost = results[0];
        res.status(200).send(blogPost);
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).send({ msg: "Error processing request" });
  }
});

app.post("/enviar-email", async (req, res) => {
  const { nome, email, telefone, cidadeUF, empresa, mensagem } = req.body;

  let transporter = nodemailer.createTransport({
    host: "smtp-mail.outlook.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: "contatopets@petsmellon.com.br",
      pass: "Patense2438",
    },
  });

  let info = await transporter.sendMail({
    from: "contatopets@petsmellon.com.br",
    to: "site@patense.com.br",
    subject: "Contato pelo Site",
    html: `
        <p><strong>Nome:</strong> ${nome}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Telefone:</strong> ${telefone}</p>
        <p><strong>Cidade/UF:</strong> ${cidadeUF}</p>
        <p><strong>Empresa:</strong> ${empresa}</p>
        <p><strong>Mensagem:</strong> ${mensagem}</p>
      `,
  });

  console.log("Message sent: %s", info.messageId);
  console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));

  res.sendStatus(200);
});

app.post("/register", (req, res) => {
  const { email, password } = req.body;

  // Verifica se o usuário já existe no banco de dados
  db.query("SELECT * FROM Users WHERE email = ?", [email], (err, result) => {
    if (err) {
      throw err;
    }

    // Se o usuário já existir, retorna uma resposta de erro
    if (result.length > 0) {
      res.status(409).json({ error: "Usuário já existe" });
    } else {
      // Caso contrário, insere o novo usuário no banco de dados
      bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
          throw err;
        }

        // Insere o usuário com a senha criptografada
        db.query(
          "INSERT INTO Users (email, password) VALUES (?, ?)",
          [email, hash],
          (err) => {
            if (err) {
              throw err;
            }
            res.status(201).json({ message: "Usuário registrado com sucesso" });
          }
        );
      });
    }
  });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  // Verifica se o usuário existe no banco de dados
  db.query("SELECT * FROM Users WHERE email = ?", [email], (err, result) => {
    if (err) {
      throw err;
    }

    // Se o usuário não existir, retorna uma resposta de erro
    if (result.length === 0) {
      res.status(401).json({ error: "Usuário ou senha inválidos" });
    } else {
      // Compara a senha fornecida com a senha armazenada no banco de dados
      bcrypt.compare(password, result[0].password, (err, match) => {
        if (err) {
          throw err;
        }

        // Se a senha corresponder, gera um token de autenticação e retorna o ID do usuário
        if (match) {
          const { id } = result[0];
          const token = jwt.sign({ email }, "seu_segredo");
          res.status(200).json({ token, userId: id });
        } else {
          res.status(401).json({ error: "Usuário ou senha inválidos" });
        }
      });
    }
  });
});

const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"];

  if (!token) {
    return res
      .status(401)
      .json({ error: "Token de autenticação não fornecido" });
  }

  jwt.verify(token, "seu_segredo", (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Token de autenticação inválido" });
    }

    req.user = decoded;
    next();
  });
};

app.post("/resetpassword", (req, res) => {
  const { token, password } = req.body;

  // Verifica se o token é válido
  jwt.verify(token, "seu_segredo", (err, decoded) => {
    if (err) {
      return res
        .status(403)
        .json({ error: "Token de redefinição de senha inválido" });
    }

    const { email } = decoded;

    // Atualize a senha do usuário no banco de dados
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        throw err;
      }

      db.query(
        "UPDATE Users SET password = ? WHERE email = ?",
        [hash, email],
        (err, result) => {
          if (err) {
            throw err;
          }

          if (result.affectedRows === 0) {
            return res.status(404).json({ error: "E-mail não encontrado" });
          }

          res.status(200).json({ message: "Senha redefinida com sucesso" });
        }
      );
    });
  });
});

// Rota para redefinição de senha
app.post("/forgotpassword", (req, res) => {
  const { email } = req.body;

  // Verifica se o e-mail existe no banco de dados
  db.query("SELECT * FROM Users WHERE email = ?", [email], (err, result) => {
    if (err) {
      throw err;
    }

    // Se o e-mail não existir, retorna uma resposta de erro
    if (result.length === 0) {
      res.status(404).json({ error: "E-mail não encontrado" });
    } else {
      // Gera um token de redefinição de senha e envia-o por e-mail
      const resetToken = jwt.sign({ email }, "seu_segredo", {
        expiresIn: "1h", // Define o tempo de expiração do token
      });

      const mailOptions = {
        from: "contatopets@petsmellon.com.br",
        to: email,
        subject: "Redefinição de Senha",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
            <div style="background-color: #00416a; padding: 20px; text-align: center;">
            <h1>Pets<span style=" color: 'rgb(245, 133, 37)' ">Mellon</span></h1>
              <h1 style="color: #fff; margin-top: 20px;">Redefinição de Senha</h1>
            </div>
            <div style="background-color: #fff; padding: 20px;">
              <p style="color: #000; font-size: 18px;">Olá,</p>
              <p style="color: #000; font-size: 18px;">Você solicitou a redefinição da sua senha. Clique no botão abaixo para criar uma nova senha:</p>
              <div style="text-align: center; margin-top: 30px;">
                <a href="http://localhost:3000/ResetPassword?token=${resetToken}"
                  style="display: inline-block; padding: 12px 24px; background-color: #00416a; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">
                  Redefinir Senha
                </a>
              </div>
              <p style="color: #000; font-size: 18px; margin-top: 30px;">Se você não solicitou essa redefinição de senha, ignore este email.</p>
            </div>
          </div>
        `,
      };

      // Enviar o e-mail
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error(error);
          res.status(500).json({ error: "Erro ao enviar o e-mail" });
        } else {
          console.log("E-mail enviado: " + info.response);
          res
            .status(200)
            .json({ message: "E-mail de redefinição de senha enviado" });
        }
      });
    }
  });
});

app.put("/blog/:uuid", upload.single("image"), async (req, res) => {
  const { conteudo, title, url_amigavel } = req.body;
  const uuid = req.params.uuid;

  // Verifique se uma foto foi enviada
  let image;
  if (req.file) {
    image = req.file.location; // Utilize a URL da foto enviada
  }

  // Gere a string da consulta SQL
  let query = "UPDATE blog SET ";
  const queryParams = [];
  if (conteudo) {
    query += "conteudo = ?, ";
    queryParams.push(conteudo);
  }
  if (url_amigavel) {
    query += "url_amigavel = ?, ";
    queryParams.push(url_amigavel);
  }
  if (title) {
    query += "title = ?, ";
    queryParams.push(title);
  }
  if (image) {
    query += "image = ?, ";
    queryParams.push(image);
  }

  query = query.slice(0, -2); // Remova a última vírgula e espaço
  query += " WHERE uuid = ?";
  queryParams.push(uuid);

  new Promise((resolve, reject) => {
    db.query(query, queryParams, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  })
    .then((results) => {
      res.status(200).send({ msg: "Post do blog atualizado com sucesso" });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send({ msg: "Erro ao processar a solicitação" });
    });
});

app.delete("/blog/:uuid", async (req, res) => {
  try {
    const uuid = req.params.uuid;
    db.query("DELETE FROM blog WHERE uuid=?", [uuid], (err, results) => {
      if (err) {
        console.error(err);
        res.status(500).send({ msg: "Error processing request" });
        return;
      }
      if (results.affectedRows === 0) {
        res.status(404).send({ msg: "Blog post not found" });
        return;
      }
      res.status(200).send({ msg: "Blog post deleted successfully" });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ msg: "Error processing request" });
  }
});

app.listen(port, () => {
  console.log(`RODANDO NA PORTA ${port}`);
});
