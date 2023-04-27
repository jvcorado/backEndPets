const express = require('express') //backend geral
const app = express() 
const router = express.Router() //rotas de controle
const mysql = require('mysql') //bd
const cors = require('cors') // mecanismo de segurança
const multer = require('multer') //foto
const path = require('path') //foto
const nodemailer = require('nodemailer') //integração smtp email
const bodyParser = require('body-parser');
const port = process.env.PORT || 4000;


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname)); //Appending extension
    },
  });
  
const upload = multer({ storage: storage });

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "Adriano4ever$",
    database: "pets",
});


app.use("/uploads", express.static("uploads"));//criando a pasta caso eu nao tenha
app.use(express.json())
app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }));

/* return res.json([{'title':'Testano o server', 'conteudo':'conteudo do post sobre o back-end'}]) */


app.post("/blog", upload.single("image"), async (req, res) => {
  
  const {title,conteudo,url_amigavel} = req.body;
  
  if(!req.file){
    throw Error("Arquivo não encontrado.")
  }
  
  const image = req.file.filename;//onde sera feito o upload da imagem
  
  try {
    const result = await db.query(
      "INSERT INTO blog (image, title, url_amigavel, conteudo) VALUES (?, ?, ?, ?)",
      [image, title, url_amigavel,  conteudo]
      );
      
      res.status(201).send({ msg: "Blog post added successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).send({ msg: "Error processing request" });
    }
  });
  
  app.get("/blog", (req, res) => {
    db.query("SELECT * FROM blog", (err, result) => {
      if (err) {
        res.send(err);
      }
    
      // Converter cada objeto do resultado em uma string
      const stringResult = result.map((row) => {
        for (const [key, value] of Object.entries(row)) {
          if (Buffer.isBuffer(value)) {
            row[key] = value.toString();
          }
        }
        return row;
      });
  
      res.send(stringResult);
    });
  });


  app.post('/enviar-email', async (req, res) => {
    const { nome, email, telefone, cidadeUF, empresa, mensagem } = req.body;
  
    let transporter = nodemailer.createTransport({
      host: "smtp-mail.outlook.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: "contatopets@petsmellon.com.br",
        pass: "Patense2438"
      },
    });
  
    let info = await transporter.sendMail({
      from: "contatopets@petsmellon.com.br",
      to: "benolopesdias@gmail.com",
      subject: "Contato pelo Site",
      html: `
        <p><strong>Nome:</strong> ${nome}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Telefone:</strong> ${telefone}</p>
        <p><strong>Cidade/UF:</strong> ${cidadeUF}</p>
        <p><strong>Empresa:</strong> ${empresa}</p>
        <p><strong>Mensagem:</strong> ${mensagem}</p>
      `
    });
  
    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    
    res.sendStatus(200);
  });




  
  //smtp email
  /* async function main() {
    // Generate test SMTP service  account from ethereal.email
    // Only needed if you don't have a real mail account for testing
    let testAccount = await nodemailer.createTestAccount();
  
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
      host: "smtp-mail.outlook.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: "contatopets@petsmellon.com.br",
        pass: "Patense2438"
      },
    });
  
    // send mail with defined transport object
    let info = await transporter.sendMail({
      from: "contatopets@petsmellon.com.br", // sender address
      to: "benolopesdias@gmail.com", // list of receivers
      subject: "teste", // Subject line
      text: "teste", // plain text body
  // html body
    });
  
    console.log("Message sent: %s", info.messageId);
    // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
  
    // Preview only available when sending through an Ethereal account
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
  }
  
  main().catch(console.error); */

  app.listen(port, () => {
    console.log(`RODANDO NA PORTA ${port}`)
})

