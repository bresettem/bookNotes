import express from "express";
import pg from "pg";
import bodyParser from "body-parser";
import "dotenv/config";
const app = express();
const port = 3000;

const db = new pg.Client({
  user: process.env.USER,
  host: "localhost",
  database: process.env.DATABASE,
  password: process.env.PASSWORD,
  port: 5432,
});

db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", async (req, res) => {
  res.render("index.ejs");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}.`);
});
