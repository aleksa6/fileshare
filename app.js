const path = require("path");

require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const csrf = require("csurf");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const MongoDBStore = require("connect-mongodb-session")(session);
const flash = require("connect-flash");
// const { v4: uuidv4 } = require("uuid");
// const multer = require("multer");

const authRoutes = require("./routes/auth");
const groupRoutes = require("./routes/groups");
const { message } = require("./util/util");

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from same IP",
});

const app = express();
const MONGODB_URI = process.env.MONGODB_URI;
const csrfProtection = csrf();
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: "sessions",
});
// const fileStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "files");
//   },
//   filename: (req, file, cb) => {
//     cb(null, `${uuidv4()}.${file.originalname.split(".").slice(-1)}`);
//   },
// });

app.set("view engine", "ejs");

app.use(limiter);
app.use(express.urlencoded({ extended: false }));
// app.use(multer({ storage: fileStorage }).any("file"));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/files", express.static(path.join(__dirname, "files")));
app.use(
  session({
    secret: "momirKraljLegendaIdol",
    resave: false,
    saveUninitialized: false,
    store,
  })
);
app.use(csrfProtection);
app.use(flash());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use((req, res, next) => {
  res.locals.isLoggedIn = req.session.isLoggedIn;
  res.locals.isInGroup = req.session.isInGroup;
  res.locals.group = req.session.group;
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use("/auth", authRoutes);
app.use(groupRoutes);

app.use((req, res, next) => {
  res.render("404", { pageTitle: "Not Found" });
});

app.use((error, req, res, next) => {
  console.log(error);

  if (req.files.length > 0)
    req.files.forEach(async (file) => await fs.unlink(file.path));

  message(req, res, error.title || "Error", error.msg, false);
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(3000);
  })
  .catch((err) => console.log(err));
