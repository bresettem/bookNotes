import express from "express";
import pg from "pg";
import bodyParser from "body-parser";
import axios from "axios";
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
  const result = await db.query(
    "SELECT * FROM books INNER JOIN google_api on books.id = books_id"
  );
  const rows = result.rows;
  const rawToday = new Date().toLocaleDateString();
  const formattedToday = rawToday.split("/");
  const today = `${formattedToday[2]}-${formattedToday[0]}-${formattedToday[1]}`;
  res.render("index.ejs", { result: rows, today: today });
});

app.get("/book", async (req, res) => {
  const rawToday = new Date().toLocaleDateString();
  const formattedToday = rawToday.split("/");
  const today = `${formattedToday[2]}-${formattedToday[0]}-${formattedToday[1]}`;
  res.render("new.ejs", { today: today });
});
app.post("/new", async (req, res) => {
  try {
    const result = await db.query(
      "INSERT INTO books (ratings, date_read, times_read, status, type,notes) VALUES ($1,$2,$3,$4,$5, $6) RETURNING id",
      [
        req.body.rating,
        [req.body.dateRead],
        req.body.timesRead,
        req.body.status,
        req.body.type,
        req.body.notes,
      ]
    );
    const id = result.rows[0].id;

    const response = await axios.get(
      `https://www.googleapis.com/books/v1/volumes/${req.body.book}`
    );
    let retailPrice,
      currencyCode,
      isbn10,
      isbn13 = null;
    const data = response.data;
    // console.log("data", data);
    const googleId = data.id;
    const title = data.volumeInfo.title;
    const subtitle = data.volumeInfo.subtitle;
    const authors = data.volumeInfo.authors;
    const publishedDate = data.volumeInfo.publishedDate;
    const description = data.volumeInfo.description;
    const pageCount = data.volumeInfo.pageCount;
    const isbn10Object = data.volumeInfo.industryIdentifiers.find(
      (item) => item.type === "ISBN_10"
    );
    isbn10 = isbn10Object ? isbn10Object.identifier : null;
    const isbn13Object = data.volumeInfo.industryIdentifiers.find(
      (item) => item.type === "ISBN_13"
    );
    isbn13 = isbn13Object ? isbn13Object.identifier : null;
    const categories = data.volumeInfo.categories;
    const uniqueCategories = Array.from(
      new Set(
        categories.flatMap((category) =>
          category.split("/").map((term) => term.trim())
        )
      )
    );

    const averageRating = data.volumeInfo.averageRating;
    const ratingsCount = data.volumeInfo.ratingsCount;
    const thumbnail = data.volumeInfo.imageLinks;

    if (data.saleInfo.saleability !== "NOT_FOR_SALE") {
      retailPrice = data.saleInfo.retailPrice.amount;
      currencyCode = data.saleInfo.retailPrice.currencyCode;
    }

    const insertQuery = `
      INSERT INTO google_api (
        google_id, title, subtitle, authors, published_date, description,
        page_count, isbn_10, isbn_13, categories, average_rating, ratings_count,
        thumbnail, retail_price, currency_code, books_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
    `;

    const values = [
      googleId,
      title,
      subtitle,
      authors,
      publishedDate,
      description,
      pageCount,
      isbn10,
      isbn13,
      uniqueCategories,
      averageRating,
      ratingsCount,
      thumbnail,
      retailPrice,
      currencyCode,
      id,
    ];

    await db.query(insertQuery, values);

    res.redirect("/");
  } catch (err) {
    console.error(err);
  }
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}.`);
});
