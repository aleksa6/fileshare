const path = require("path");
const fs = require("fs");

require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const csrf = require("csurf");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const MongoDBStore = require("connect-mongodb-session")(session);
const flash = require("connect-flash");

const authRoutes = require("./routes/auth");
const groupRoutes = require("./routes/groups");
const { message, clearFiles } = require("./util/util");
const Group = require("./models/group");
const User = require("./models/user");

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

app.set("view engine", "ejs");

app.use(limiter);
app.use(express.urlencoded({ extended: false }));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/files", express.static(path.join(__dirname, "files")));
app.use(
	session({
		secret: process.env.SECRET,
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
	res.locals.alertMessage = req.flash("alertMessage")[0] || null;
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

app.use(async (error, req, res, next) => {
	console.log(error);

	clearFiles(req);

	message(
		req,
		res,
		error.title || "Error",
		error.message || "Internal server error",
		false
	);
});

mongoose
	.connect(MONGODB_URI)
	.then(async () => {
		// app.listen(3000)
		const group = (await Group.find())[0];
		group.delete()
	})
	.catch((err) => console.log(err));
