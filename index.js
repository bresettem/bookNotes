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

function isValidDateFormat(dateString) {
  // Regular expression for the 'YYYY-MM-DD' format
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  // Test if the provided string matches the pattern
  return datePattern.test(dateString);
}

app.get("/", async (req, res) => {
  const result = await db.query(
    "SELECT * FROM books JOIN google_api on books.id = books_id"
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

app.get("/edit", async (req, res) => {
  const id = parseInt(req.query.id);
  const r = await db.query(
    `SELECT books.id, ratings, date_read, times_read, type, status, notes,title, google_id FROM books INNER JOIN google_api on books.id = books_id WHERE books.id=${id}`
  );
  const result = r.rows[0];
  const title = result.title;
  const ratings = result.ratings;
  const date_read = result.date_read[0];
  const times_read = result.times_read;
  const type = result.type;
  const status = result.status;
  const notes = result.notes;
  const googleId = result.google_id;
  const rawToday = new Date(date_read);
  const year = rawToday.getFullYear();
  const month = (rawToday.getMonth() + 1).toString().padStart(2, "0"); // Pad month with zero if needed
  const day = rawToday.getDate().toString().padStart(2, "0"); // Pad day with zero if needed
  const date = `${year}-${month}-${day}`;
  // const date = "1973-05-12";
  const statusOptions = ["reading", "dropped", "completed"];
  const typeBook = ["audiobook", "ebook", "physical"];
  res.render("edit.ejs", {
    id: id,
    title: title,
    ratings: ratings,
    date_read: date,
    times_read: times_read,
    type: type,
    status: status,
    notes: notes,
    status_options: statusOptions,
    type_book: typeBook,
    google_id: googleId,
  });
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
    const googleId = data.id;
    const title = data.volumeInfo.title;
    const subtitle = data.volumeInfo.subtitle;
    const authors = data.volumeInfo.authors;
    let publishedDate = data.volumeInfo.publishedDate;
    const isValid = isValidDateFormat(publishedDate);
    let releaseYear;
    if (isValid === true) {
      releaseYear = new Date(publishedDate).getFullYear();
    } else {
      releaseYear = publishedDate;
      publishedDate = null;
    }
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
        thumbnail, retail_price, currency_code, books_id, release_year
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
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
      releaseYear,
    ];
    await db.query(insertQuery, values);

    res.redirect("/");
  } catch (err) {
    console.error(err);
  }
});
app.post("/edit", async (req, res) => {
  try {
    const updatedGoogleId = req.body.book;
    const currentGoogleId = req.body.googleId;

    const updatedId = parseInt(req.body.updatedId);
    const rating = req.body.rating;
    const dateRead = [req.body.dateRead];
    const timesRead = req.body.timesRead;
    const status = req.body.status;
    const type = req.body.type;
    const notes = req.body.notes;

    // if (updatedTitle === "") {
    //   throw "Updated item cannot be empty";
    // }
    await db.query(
      "UPDATE books SET ratings = $1, date_read = $2, times_read = $3, status = $4, type = $5, notes = $6 WHERE id = $7",
      [rating, dateRead, timesRead, status, type, notes, updatedId]
    );
    if (updatedGoogleId != undefined) {
      const result = await db.query(
        `SELECT * FROM google_api WHERE google_id = '${updatedGoogleId}';`
      );

      if (result.rows.length != 0) {
        throw "Updated book has already been inserted.";
      }

      const response = await axios.get(
        `https://www.googleapis.com/books/v1/volumes/${updatedGoogleId}`
      );
      let retailPrice,
        currencyCode,
        isbn10,
        isbn13 = null;
      const data = response.data;
      // const googleId = data.id;
      const title = data.volumeInfo.title;
      const subtitle = data.volumeInfo.subtitle;
      const authors = [data.volumeInfo.authors];
      let publishedDate = data.volumeInfo.publishedDate;
      const isValid = isValidDateFormat(publishedDate);
      let releaseYear;
      if (isValid === true) {
        releaseYear = new Date(publishedDate).getFullYear();
      } else {
        releaseYear = publishedDate;
        publishedDate = null;
      }
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

      // TODO: Fix the duplicate key value violates unique constraint "google_api_google_id_key" when the google_id is not in the table.
      await db.query("DELETE FROM google_api WHERE google_id = $1", [
        currentGoogleId,
      ]);
      console.log(
        `Deleted ${currentGoogleId} and replaced it with ${updatedGoogleId}`
      );
      const insertQuery = `
      INSERT INTO google_api (
        google_id, title, subtitle, authors, published_date, description,
        page_count, isbn_10, isbn_13, categories, average_rating, ratings_count,
        thumbnail, retail_price, currency_code, books_id, release_year
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      )
    `;

      const values = [
        updatedGoogleId,
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
        updatedId,
        releaseYear,
      ];
      await db.query(insertQuery, values);
    }
    res.redirect("/");
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send(`Internal Server Error: \n${err}`);
  }
});

app.post("/delete", async (req, res) => {
  try {
    const id = req.body.deleteItemId;
    // TODO: use cascade delete instead of two queries.
    await db.query("DELETE FROM google_api WHERE books_id = $1", [id]);
    await db.query("DELETE FROM books WHERE id = $1", [id]);

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send(`Internal Server Error: ${err}`);
  }
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}.`);
});
